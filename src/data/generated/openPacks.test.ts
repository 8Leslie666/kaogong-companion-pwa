import { describe, expect, it } from 'vitest'
import { parseQuestionPack } from '../../domain/schemas'
import { openQuestionPacks } from './openPacks'

describe('generated open-source packs', () => {
  it('keeps source metadata, unique stable IDs and complete explanations', () => {
    expect(openQuestionPacks.map((pack) => pack.questions.length)).toEqual([52, 165, 1200, 800])
    const ids = new Set<string>()
    for (const pack of openQuestionPacks) {
      expect(() => parseQuestionPack(pack)).not.toThrow()
      expect(pack.questions.every((question) => question.explanation.trim().length > 8)).toBe(true)
      for (const question of pack.questions) {
        expect(ids.has(question.id), question.id).toBe(false)
        ids.add(question.id)
      }
    }
  })
})
