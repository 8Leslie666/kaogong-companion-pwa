import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSeedData } from '../db/database'
import { createPracticeSession, getDueQuestionIds, rateReview, Rating, recordAnswer } from './practice'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await ensureSeedData()
})

afterEach(async () => { await db.delete() })

describe('practice records and review scheduling', () => {
  it('persists an answer and creates a due wrong-question state', async () => {
    const question = await db.questions.get('ori-pol-001')
    const session = await createPracticeSession({ mode: 'instant', questionIds: [question!.id] })
    const wrongAnswer = (['A', 'B', 'C', 'D'] as const).find((answer) => answer !== question!.answer)!
    expect(await recordAnswer(session.id, question!.id, wrongAnswer, 12)).toBe(false)
    expect(await db.attempts.count()).toBe(1)
    expect(await getDueQuestionIds()).toContain(question!.id)
  })

  it('uses FSRS ratings to persist the next review time', async () => {
    const due = await rateReview('ori-pol-001', Rating.Good)
    expect(new Date(due).getTime()).toBeGreaterThan(Date.now())
    expect((await db.reviewCards.get('ori-pol-001'))?.lastRating).toBe(Rating.Good)
  })

  it('builds a session from pack, difficulty and local learning-status filters', async () => {
    const question = await db.questions.get('ori-pol-001')
    const first = await createPracticeSession({ mode: 'instant', questionIds: [question!.id] })
    const wrongAnswer = (['A', 'B', 'C', 'D'] as const).find((answer) => answer !== question!.answer)!
    await recordAnswer(first.id, question!.id, wrongAnswer, 8)

    const wrongOnly = await createPracticeSession({
      mode: 'instant', count: 20, module: question!.module, difficulty: question!.difficulty,
      packId: question!.packId, status: '错题',
    })
    expect(wrongOnly.questionIds).toEqual([question!.id])

    const unseen = await createPracticeSession({
      mode: 'instant', count: 20, packId: question!.packId, status: '未做题',
    })
    expect(unseen.questionIds).not.toContain(question!.id)
    expect(unseen.questionIds.length).toBe(20)
  })

  it('filters historical papers by year, region and variant', async () => {
    const session = await createPracticeSession({
      mode: 'instant', count: 200, year: 2025, region: '浙江', variant: 'A类',
    })
    const questions = (await db.questions.bulkGet(session.questionIds)).filter(Boolean)
    expect(questions).toHaveLength(125)
    expect(questions.every((question) => question?.year === 2025 && question.region === '浙江' && question.variant === 'A类')).toBe(true)
  })
})
