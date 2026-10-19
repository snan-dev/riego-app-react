// ═══════════════════════════════════════════════════
//  config/mqtt.ts  —  equivalente a config.h del firmware
// ═══════════════════════════════════════════════════

export const MQTT_CONFIG = {
  host:     'v01204cf.ala.us-east-1.emqxsl.com',
  port:     8084,
  username: 'app-riego',
  password: '310592',
  clientId: 'web-riego-' + Math.random().toString(16).slice(2, 10),
} as const;

export const TOPICS = {
  cmdProgram: 'riego/cmd/program',
  cmdManual:  'riego/cmd/manual',
  cmdSync:    'riego/cmd/sync',
  cmdPause:   'riego/cmd/pause',
  status:     'riego/status',
  programs:   'riego/programs',
  ack:        'riego/ack',
} as const;

export const MAX_PROGRAMS   = 32;
export const MAX_ZONES      = 4;
export const MAX_DURATION   = 60;
export const OFFLINE_TIMEOUT_S = 90;

export const ZONE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7'] as const;
export const ZONE_COLORS_DIM = [
  'rgba(59,130,246,0.15)',
  'rgba(34,197,94,0.15)',
  'rgba(245,158,11,0.15)',
  'rgba(168,85,247,0.15)',
] as const;

export const DAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;
export const DAY_FULL  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
