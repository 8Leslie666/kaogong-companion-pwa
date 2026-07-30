import { describe, expect, it } from 'vitest'
import { EXAM_MODULES } from '../domain/types'
import { originalQuestions } from './originalQuestions'
import { essayPapers } from './essayPapers'

describe('built-in learning content', () => {
  it('ships at least thirty explained questions for every official module', () => {
    for (const module of EXAM_MODULES) {
      const questions = originalQuestions.filter((question) => question.module === module)
      expect(questions.length, module).toBeGreaterThanOrEqual(30)
      expect(questions.every((question) => question.explanation.trim().length > 8), module).toBe(true)
    }
  })

  it('ships two essay papers for each position type', () => {
    expect(essayPapers).toHaveLength(6)
    for (const type of ['中央省级综合管理', '市县综合管理', '行政执法']) {
      expect(essayPapers.filter((paper) => paper.positionType === type)).toHaveLength(2)
    }
    expect(essayPapers.every((paper) => paper.tasks.length >= 3)).toBe(true)
  })
})

