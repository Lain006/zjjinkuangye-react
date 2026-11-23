import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pool } from 'pg'
import { z } from 'zod'
import { createPool, transaction } from './db.ts'
import { insertDocument } from './documents.ts'
import { completeDocument, seedDocument } from './model.ts'

export async function seed(pool: Pool, input: unknown) {
  const records = z.array(seedDocument).parse(input).map(({ id, status, legacyId, ...fields }) => {
    const stableId = id ?? (legacyId ? `legacy-${legacyId}` : `source-${createHash('sha256').update(fields.sourceUrl).digest('hex').slice(0, 24)}`)
    return completeDocument(fields, stableId, status ?? 'draft', legacyId ?? null)
  })
  const uniqueIds = new Set(records.map((record) => record.id))
  const uniqueUrls = new Set(records.map((record) => record.sourceUrl))
  const legacy = records.map((record) => record.legacyId).filter((id) => id !== null)
  if (uniqueIds.size !== records.length || uniqueUrls.size !== records.length || new Set(legacy).size !== legacy.length) {
    throw new Error('Seed input contains duplicate IDs or source links')
  }

  return transaction(pool, async (client) => {
    let inserted = 0
    for (const record of records) {
      if (await insertDocument(client, record, true)) inserted += 1
    }
    return { inserted, existing: records.length - inserted }
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let pool: Pool | undefined
  try {
    pool = createPool()
    const file = new URL('../data/seed.json', import.meta.url)
    const input: unknown = JSON.parse(await readFile(file, 'utf8'))
    const { inserted, existing } = await seed(pool, input)
    console.log(`Seed complete. Inserted ${inserted}, existing ${existing}.`)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Seed validation failed for fields:', error.issues.map((issue) => issue.path.join('.')).join(', '))
    } else {
      console.error('Seed failed. Check the input file, schema and database connection.')
    }
    process.exitCode = 1
  } finally {
    await pool?.end()
  }
}
