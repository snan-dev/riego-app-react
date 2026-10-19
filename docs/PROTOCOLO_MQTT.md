# Protocolo MQTT app ↔ ESP8266

Contrato entre la app (`riego-app-react`) y el firmware. Reconstruido a partir del código de la app
(`src/config/mqtt.ts`, `src/hooks/useMQTT.tsx`, `src/hooks/useIrrigation.ts`, `src/lib/types.ts`).
**El firmware actual del repo `Watering-System` no implementa este protocolo**; esto es lo que el firmware debe cumplir.

> Este protocolo es el mismo que usa la versión anterior de la app, `snan-dev/riego-v2` (JS puro).
> De esa versión salen estos datos del firmware: días como `uint8`, duración por zona como `uint8` (0–255 min; la app React limita a 60),
> `manual/off` se ignora sin riego manual activo, y `pause`/`resume` responden `ack` con error si no hay programa activo / pausa activa o si hay riego manual.

## Conexión

- Broker: HiveMQ Cloud, WebSocket seguro: `wss://<host>:8884/mqtt` (la app). El ESP8266 normalmente usaría MQTT sobre TLS (puerto 8883).
- Credenciales: usuario/clave en `src/config/mqtt.ts` (ver advertencia de seguridad en el README).
- La app usa `clean: true`, reconexión cada 3 s, timeout de conexión 10 s, `clientId` aleatorio `web-riego-xxxxxxxx`.
- Todos los payloads son JSON en texto. No se usa `retain` ni QoS explícito (valores por defecto de mqtt.js: QoS 0).

## Topics

| Topic | Dirección | Contenido |
|---|---|---|
| `riego/cmd/program` | app → ESP | Crear/modificar/borrar/detener programa |
| `riego/cmd/manual` | app → ESP | Riego manual de una zona |
| `riego/cmd/pause` | app → ESP | Pausar/reanudar programa |
| `riego/cmd/sync` | app → ESP | Pedir la lista de programas (payload `{}`) |
| `riego/status` | ESP → app | Estado en vivo (la app se suscribe) |
| `riego/programs` | ESP → app | Lista completa de programas |
| `riego/ack` | ESP → app | Confirmación/error de un comando |

La app envía `riego/cmd/sync` al conectarse y después de cada `ack` de programa (`set`/`delete`).

## Comandos (app → ESP)

### `riego/cmd/program`
```json
{ "action": "set", "id": 3, "enabled": true, "start": "07:30", "days": [1,2,3,4,5], "zones": [10,10,5,0] }
{ "action": "delete", "id": 3 }
{ "action": "stop" }
```
- `set`: crea o reemplaza el programa del slot `id` (0–31). `days` llega como **arreglo de índices de día** (0 = domingo … 6 = sábado); el comentario del código dice que el ESP debe aceptar arreglo o bitmask. `zones` son 4 enteros: minutos de riego por zona (0 = zona inactiva, máx. 60).
- `stop`: detiene el riego programado en curso.

### `riego/cmd/manual`
```json
{ "action": "on", "zone": 2 }
{ "action": "off" }
```
`zone` es 1–4. Activar una zona cancela un programa en curso (la app lo advierte al usuario). Sin límite de tiempo: queda regando hasta `off`.

### `riego/cmd/pause`
```json
{ "action": "pause" }
{ "action": "resume" }
```

## Mensajes (ESP → app)

### `riego/status`
```json
{
  "online": true,
  "pump": true,
  "programCount": 3,
  "mode": "program",
  "program": 3,
  "zone": 2,
  "remaining": 7,
  "timestamp": 1792262570
}
```
| Campo | Significado |
|---|---|
| `mode` | `idle`, `program`, `manual` o `paused` |
| `program` | id del programa en curso (solo en `program`/`paused`) |
| `zone` | zona en curso, 1–4 (solo en `program`/`manual`/`paused`) |
| `remaining` | minutos restantes de la zona actual (solo en `program`/`paused`, no en `manual`) |
| `timestamp` | tiempo Unix en UTC; **requiere que el ESP tenga hora (NTP)** |

Si el `timestamp` más reciente tiene más de 90 s de antigüedad, la app se considera desconectada del ESP, por lo que el ESP debe publicar `status` periódicamente (idealmente cada ≤ 30 s y ante cada cambio).

### `riego/programs`
```json
{ "programs": [ { "id": 3, "enabled": true, "days": 62, "start": "07:30", "zones": [10,10,5,0] } ] }
```
Aquí `days` es un **bitmask** (ver abajo), no un arreglo.

### `riego/ack`
```json
{ "cmd": "program", "action": "set", "id": 3, "ok": true }
{ "cmd": "manual", "action": "on", "id": 0, "ok": false, "error": "mensaje a mostrar" }
```
`cmd` ∈ `program | manual | pause`. Si `ok` es `false`, la app muestra `error` en un aviso.

## Codificación de días (bitmask)

El bit $d$ vale 1 si el día $d$ está activo (0 = domingo, 1 = lunes, …, 6 = sábado):

$$\text{mask} = \sum_{d \in \text{días}} 2^{d}$$

Ejemplos (`src/lib/programs.ts`):

| Días | Cuenta | `mask` |
|---|---|---|
| Lun–Vie ($d=1..5$) | $2+4+8+16+32$ | 62 |
| Dom y Sáb ($d=0,6$) | $1+64$ | 65 |
| Todos | $2^7-1$ | 127 |
| Ninguno | — | 0 |

Para saber si el día $d$ está activo: $(\text{mask} \gg d)\ \&\ 1$.

## Notas para implementar el firmware

- Slots: 32 programas, ids 0–31; la app elige el primer id libre al crear.
- Zonas: 4. Se riegan en orden (zona 1 → 4), saltando las de 0 minutos; `remaining` cuenta los minutos de la zona actual.
- El firmware necesita hora real (NTP, y zona horaria Uruguay UTC−3) para disparar programas y para `timestamp`.
- Debe publicar `status` y `programs` y responder siempre con un `ack` a cada comando.
- Cualquier cambio de estructura (nuevos campos, topics) debe reflejarse en este documento y en `src/lib/types.ts`.
