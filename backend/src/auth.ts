import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { CookieOptions, Request } from 'express'
import type { Pool } from 'pg'
import { transaction } from './db.ts'

const cookieName = 'zj_session'
const sessionLifetime = 8 * 60 * 60 * 1000
const digest = (value: string) => createHash('sha256').update(value).digest()

function cookieToken(request: Request) {
  const raw = request.get('cookie')?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
  return raw && /^[A-Za-z0-9_-]{43}$/.test(raw) ? raw : null
}

export function sessions(pool: Pool, password: string, secure: boolean) {
  const expectedPassword = digest(password)
  // A password rotation also revokes previously issued sessions.
  const hashToken = (token: string) => createHmac('sha256', expectedPassword).update(token).digest('hex')
  const requestTokenHash = (request: Request) => {
    const token = cookieToken(request)
    return token && hashToken(token)
  }
  const cookieOptions: CookieOptions = { httpOnly: true, sameSite: 'strict', secure, path: '/api/v1/admin' }

  return {
    options: cookieOptions,
    cookieName,
    maxAge: sessionLifetime,
    passwordMatches: (candidate: string) => timingSafeEqual(expectedPassword, digest(candidate)),
    async authenticated(request: Request) {
      const token = requestTokenHash(request)
      if (!token) return false
      const result = await pool.query('SELECT 1 FROM admin_sessions WHERE token_hash = $1 AND expires_at > now()', [token])
      return Boolean(result.rowCount)
    },
    async open(request: Request) {
      const previous = requestTokenHash(request)
      const token = randomBytes(32).toString('base64url')
      await transaction(pool, async (client) => {
        await client.query('DELETE FROM admin_sessions WHERE expires_at <= now() OR token_hash = $1', [previous])
        await client.query('INSERT INTO admin_sessions (token_hash, expires_at) VALUES ($1, $2)',
          [hashToken(token), new Date(Date.now() + sessionLifetime)])
      })
      return token
    },
    async close(request: Request) {
      const token = requestTokenHash(request)
      if (token) await pool.query('DELETE FROM admin_sessions WHERE token_hash = $1', [token])
    },
  }
}

export function createRateLimit(maxAttempts: number, duration: number) {
  const attempts = new Map<string, { count: number; endsAt: number }>()
  let sweepAt = 0
  return (ip: string) => {
    const now = Date.now()
    if (now >= sweepAt) {
      for (const [key, entry] of attempts) if (entry.endsAt <= now) attempts.delete(key)
      sweepAt = now + duration
    }

    const entry = attempts.get(ip)
    if (entry && entry.endsAt > now) {
      if (entry.count >= maxAttempts) return false
      entry.count += 1
      return true
    }

    if (attempts.size >= 5_000 && !entry) return false
    attempts.set(ip, { count: 1, endsAt: now + duration })
    return true
  }
}
