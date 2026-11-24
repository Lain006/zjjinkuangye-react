import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { createPool } from './db.ts'
import { backfillEvidence } from './documents.ts'
import { seedDocument } from './model.ts'

const flags = process.argv.slice(2)
if (new Set(flags).size !== flags.length || flags.some(flag => flag !== '--apply' && flag !== '--all' && flag !== '--summary')) {
  console.error('Usage: npm run evidence:backfill -w backend -- [--all] [--apply] [--summary]')
  process.exit(1)
}
const apply = flags.includes('--apply')
const all = flags.includes('--all')
const pool = createPool()
try {
  const input: unknown = JSON.parse(await readFile(new URL('../data/seed.json', import.meta.url), 'utf8'))
  const reviewed = z.array(seedDocument).parse(input).flatMap(row => {
    const id = row.id ?? (row.legacyId ? `legacy-${row.legacyId}` : undefined)
    if (!id || !row.evidenceLocator) return []
    return [{ id, sourceUrl: row.sourceUrl, summary: row.summary ?? '', excerpt: row.excerpt ?? '',
      analysis: row.analysis ?? '', evidenceLocator: row.evidenceLocator, evidenceSourceUrl: row.evidenceSourceUrl }]
  })
  const records = await backfillEvidence(pool, reviewed, apply, all)
  const mode = apply ? 'applied' : 'preview'
  if (flags.includes('--summary')) {
    const tally = (status: 'draft' | 'published' | 'archived') => {
      const items = records.filter(record => record.status === status)
      return {
        total: items.length,
        reviewed: items.filter(record => record.verifiedSourceMatch).length,
        complete: items.filter(record => !record.gaps.length).length,
        updated: items.filter(record => record.fields.length > 0).length,
      }
    }
    console.log('Evidence backfill:', JSON.stringify({
      mode, published: tally('published'), draft: tally('draft'), archived: tally('archived'),
    }))
  } else {
    console.log(JSON.stringify({ mode, records }, null, 2))
  }
} catch {
  console.error('Evidence review failed. Check the local database connection, migrations and reviewed seed data.')
  process.exitCode = 1
} finally {
  await pool.end()
}
