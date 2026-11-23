import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { createApp } from './app.ts'
import { createPool } from './db.ts'

const env = z.object({
  DATABASE_URL: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(12).max(256),
  PUBLIC_ORIGIN: z.url({ protocol: /^https?$/ }).optional(),
  HOST: z.string().trim().min(1).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  TRUST_PROXY: z.coerce.number().int().min(0).max(4).optional(),
  NODE_ENV: z.string().optional(),
}).safeParse(process.env)

if (!env.success) {
  const invalid = env.error.issues.map((issue) => issue.path.join('.'))
  console.error(`Missing or invalid server settings: ${invalid.join(', ')}`)
  process.exit(1)
}

const settings = env.data
const production = settings.NODE_ENV === 'production'
const pool = createPool(settings.DATABASE_URL)
const directory = fileURLToPath(new URL('../../frontend/dist/', import.meta.url))
const app = createApp({
  pool,
  adminPassword: settings.ADMIN_PASSWORD,
  publicOrigin: settings.PUBLIC_ORIGIN,
  secureCookies: production,
  trustProxy: settings.TRUST_PROXY ?? (production ? 1 : 0),
  staticDirectory: existsSync(new URL('../../frontend/dist/index.html', import.meta.url)) ? directory : undefined,
})

const host = settings.HOST ?? (production ? '0.0.0.0' : '127.0.0.1')
const server = app.listen(settings.PORT, host, () => console.log(`API listening on ${host}:${settings.PORT}`))
function stop() {
  server.close(() => { void pool.end() })
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
