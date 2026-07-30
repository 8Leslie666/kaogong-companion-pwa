import { afterEach, describe, expect, it } from 'vitest'
import { KaogongDatabase, ensureSeedData } from './database'

const names: string[] = []

afterEach(async () => {
  await Promise.all(names.splice(0).map((name) => new KaogongDatabase(name).delete()))
})

describe('local database seed', () => {
  it('installs the complete built-in pack and stays idempotent', async () => {
    const name = `kaogong-test-${Date.now()}`
    names.push(name)
    const database = new KaogongDatabase(name)
    await ensureSeedData(database)
    expect(await database.questions.count()).toBe(4287)
    expect(await database.questionPacks.count()).toBe(21)
    expect(await database.essayPapers.count()).toBe(6)
    await ensureSeedData(database)
    expect(await database.questions.count()).toBe(4287)
    await database.close()
  })
})
