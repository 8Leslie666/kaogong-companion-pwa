import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSeedData } from '../db/database'
import { createBackupBundle, parseBackupBundle, restoreBackupBundle } from './backup'

beforeEach(async () => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  await db.delete(); await db.open(); await ensureSeedData()
})
afterEach(async () => { await db.delete() })

describe('versioned learning backup', () => {
  it('round-trips local records and rejects a changed checksum', async () => {
    await db.settings.put({ key: 'dailyGoal', value: 20 })
    const bundle = await createBackupBundle()
    const parsed = await parseBackupBundle(JSON.stringify(bundle))
    await db.settings.clear()
    await restoreBackupBundle(parsed)
    expect((await db.settings.get('dailyGoal'))?.value).toBe(20)

    const changed = JSON.parse(JSON.stringify(bundle))
    changed.data.settings[0].value = 99
    await expect(parseBackupBundle(JSON.stringify(changed))).rejects.toThrow(/校验和/)
  })
})
