# Riego Basquade — App web (React + TypeScript + Vite)

PWA para controlar el sistema de riego automático basado en ESP8266. Repo: `snan-dev/riego-app-react`.
El firmware vive en `snan-dev/Watering-System`.

La app **no habla directo con el ESP8266**: ambos se conectan a un broker **MQTT en la nube
(HiveMQ Cloud)** y se intercambian mensajes JSON. Detalle del protocolo en
[`docs/PROTOCOLO_MQTT.md`](docs/PROTOCOLO_MQTT.md).

```
 [App en el celular]  ⇄  wss://…hivemq.cloud:8884  ⇄  [ESP8266 en el jardín]
      (React PWA)            broker MQTT                 (firmware)
```

> ⚠️ El firmware que está hoy en `Watering-System/main` es HTTP y **no es compatible** con esta
> app (no tiene MQTT). Ver el README de ese repo.

## Qué hace la app

- **Programas**: lista (ordenada por hora), crea, edita, activa/desactiva y elimina programas de riego (hasta 32).
  Cada programa tiene hora de inicio, días de la semana y minutos de riego por zona (4 zonas, 0–60 min).
- **Manual**: enciende/apaga una zona a mano (una sola a la vez).
- **Reproductor**: pantalla de riego en curso con zona, tiempo restante, pausa/reanudar y detener. Una barra
  mini aparece sobre la barra de pestañas mientras hay riego activo.
- **Estado de conexión**: punto en la pestaña "Programas" (conectado/desconectado).
- **PWA**: instalable, con service worker que permite abrir la app sin conexión (la UI; los comandos requieren conexión).

Zonas (en `src/lib/types.ts`): 1 Fondo, 2 Centro, 3 Frente, 4 Vereda.

## Stack

React 19, React Router 7, styled-components 6, `mqtt` 5 (mqtt.js), Vite 8, TypeScript 5.9, ESLint 9.

## Desarrollo

```bash
npm install
npm run dev       # servidor local (base '/')
npm run build     # tsc -b && vite build  → dist/
npm run preview   # sirve el build
npm run lint
```

## Despliegue

GitHub Pages automático: cada push a `main` ejecuta `.github/workflows/deploy.yml`
(Node 20 → `npm ci` → `npm run build` → publica `dist/`).
En producción `vite.config.ts` usa `base: '/riego-app-react/'`, por lo que la URL queda
`https://snan-dev.github.io/riego-app-react/`. Si se renombra el repo, hay que cambiar ese `base`.
`public/404.html` aplica el truco "SPA redirect" de GitHub Pages (convierte una ruta profunda en `/?/ruta` para que la app la restaure); asume que el repo se llama `riego-app-react`.

## Estructura de `src/`

```
main.tsx               arranque + registro del service worker
App.tsx                providers (Theme, MQTT, Toast), router y TabBar
config/mqtt.ts         conexión al broker, nombres de topics, límites, colores, nombres de días
lib/types.ts           tipos: Program, EspStatus, AckMessage, ZONE_NAMES
lib/programs.ts        utilidades puras: bitmask de días, formato, slot libre, validación, orden
hooks/useMQTT.tsx      Context: conexión MQTT, estado, programas, último ack, publish
hooks/useIrrigation.ts comandos de riego (manual, programa, pausa, sync) sobre useMQTT
components/            ProgramCard, MiniPlayer, Toggle, Toast, ConfirmModal
pages/programs/        lista de programas (ruta "/")
pages/programEdit/     alta/edición de programa ("/program/:id", id = "new" para nuevo)
pages/manual/          riego manual ("/manual")
pages/player/          riego en curso ("/player")
pages/tabs/            barra inferior
styles/                tema y estilos globales
```

### Flujo de datos

1. `MQTTProvider` se conecta al broker al montar la app, se suscribe a `riego/status`, `riego/programs`
   y `riego/ack`, y publica `riego/cmd/sync` para pedir la lista de programas.
2. Los mensajes entrantes actualizan el estado (`status`, `programs`, `lastAck`).
3. Las pantallas llaman a `useIrrigation()`, que publica comandos en `riego/cmd/*` y marca `pending`
   (bloquea botones hasta que llega estado nuevo o pasan 2 s).
4. Tras un `ack` de programa (set/delete) la app vuelve a pedir `sync` para refrescar la lista.
5. Watchdog: si el `timestamp` del último `status` tiene más de 90 s, se muestra como desconectado.

## Configuración

Todo está en `src/config/mqtt.ts`: host/puerto/usuario/clave del broker, topics, `MAX_PROGRAMS = 32`,
`MAX_ZONES = 4`, `MAX_DURATION = 60`, `OFFLINE_TIMEOUT_S = 90`.

> ⚠️ **Seguridad**: usuario y clave de HiveMQ están escritos en el código fuente y la app se publica en
> GitHub Pages, así que cualquiera que abra la app (o el repo) puede verlos y publicar comandos de riego.
> Conviene rotar esa clave y, como mínimo, limitar los permisos de ese usuario en HiveMQ a los topics `riego/#`;
> idealmente agregar algún tipo de autenticación real.

## Observaciones sobre el código actual

- **Watchdog offline irreversible**: si pasa >90 s sin `status`, `connected` se pone en `false`, pero solo vuelve a `true`
  en un nuevo evento `connect` de MQTT; si el ESP reaparece con la conexión al broker intacta, la app queda "desconectada".
- ~~Detener desde el Reproductor llamaba a `stopManual()`~~ — corregido: ahora usa `cancelProgram()` (`riego/cmd/program {action:"stop"}`),
  igual que el MiniPlayer. El firmware ignora `manual/off` si no hay riego manual, así que antes el botón no detenía programas.
- `Player.tsx` llama a `navigate()` durante el render (debería ir en un `useEffect` o usar `<Navigate>`).
- `Manual.tsx` tiene un `ConfirmModal` de apagado que nunca se muestra (`confirmStop` no se activa).
- `EspStatus.online` no se usa; la presencia se infiere solo del timestamp.
- Si se abre `/program/<id>` antes de la primera sincronización, el formulario se inicializa vacío.
- `ZONE_COLORS` está duplicado en varios archivos aunque existe en `config/mqtt.ts`.
- Los comentarios mencionan archivos del firmware (`config.h`, `irrigation.h`, `storage.h`, `types.h`) que no están en el repo del firmware.
