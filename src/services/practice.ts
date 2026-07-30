import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs'
import { db, ensureSeedData } from '../db/database'
import type { AnswerKey, Difficulty, ExamModule, PracticeMode, PracticeSession, ReviewCardRecord, WrongQuestionState } from '../domain/types'

const scheduler = fsrs({ request_retention: 0.9, maximum_interval: 3650, enable_fuzz: true })

function uid(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${random}`
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

export interface CreateSessionOptions {
  mode: PracticeMode
  count?: number
  module?: ExamModule | '全部模块'
  difficulty?: Difficulty | '全部难度'
  packId?: string | '全部题源'
  year?: number | '全部年份'
  region?: string | '全部地区'
  variant?: string | '全部卷型'
  status?: QuestionStatusFilter
  questionIds?: string[]
  title?: string
}

export type QuestionStatusFilter = '全部题目' | '未做题' | '错题' | '收藏题'

export async function createPracticeSession(options: CreateSessionOptions): Promise<PracticeSession> {
  await ensureSeedData()
  let questionIds = options.questionIds
  if (!questionIds) {
    const [all, attempts, wrongStates] = await Promise.all([
      db.questions.toArray(),
      db.attempts.toArray(),
      db.wrongQuestionStates.toArray(),
    ])
    const attemptedIds = new Set(attempts.map((attempt) => attempt.questionId))
    const wrongById = new Map(wrongStates.map((state) => [state.questionId, state]))
    questionIds = shuffle(all
      .filter((question) => !options.module || options.module === '全部模块' || question.module === options.module)
      .filter((question) => !options.difficulty || options.difficulty === '全部难度' || question.difficulty === options.difficulty)
      .filter((question) => !options.packId || options.packId === '全部题源' || question.packId === options.packId)
      .filter((question) => !options.year || options.year === '全部年份' || question.year === options.year)
      .filter((question) => !options.region || options.region === '全部地区' || question.region === options.region)
      .filter((question) => !options.variant || options.variant === '全部卷型' || question.variant === options.variant)
      .filter((question) => {
        if (!options.status || options.status === '全部题目') return true
        if (options.status === '未做题') return !attemptedIds.has(question.id)
        const state = wrongById.get(question.id)
        return options.status === '错题' ? Boolean(state?.isWrong) : Boolean(state?.isFavorite)
      }))
      .slice(0, options.count ?? 10)
      .map((question) => question.id)
  }
  if (questionIds.length === 0) throw new Error('当前筛选条件下没有题目')
  const now = new Date().toISOString()
  const session: PracticeSession = {
    id: uid('session'),
    mode: options.mode,
    status: 'active',
    title: options.title ?? (options.mode === 'exam' ? '整组训练' : options.mode === 'review' ? '错题复习' : '逐题训练'),
    questionIds,
    selectedAnswers: {},
    submittedQuestionIds: [],
    currentIndex: 0,
    elapsedSeconds: 0,
    startedAt: now,
    updatedAt: now,
  }
  await db.practiceSessions.add(session)
  return session
}

export async function saveSessionProgress(sessionId: string, patch: Partial<Pick<PracticeSession, 'selectedAnswers' | 'currentIndex' | 'elapsedSeconds'>>): Promise<void> {
  await db.practiceSessions.update(sessionId, { ...patch, updatedAt: new Date().toISOString() })
}

async function updateWrongState(questionId: string, correct: boolean): Promise<void> {
  const now = new Date().toISOString()
  const current = await db.wrongQuestionStates.get(questionId)
  const next: WrongQuestionState = {
    questionId,
    isWrong: correct ? (current?.wrongCount ?? 0) > 0 && (current?.correctStreak ?? 0) + 1 < 2 : true,
    isFavorite: current?.isFavorite ?? false,
    wrongCount: (current?.wrongCount ?? 0) + (correct ? 0 : 1),
    correctStreak: correct ? (current?.correctStreak ?? 0) + 1 : 0,
    due: correct ? (current?.due ?? now) : now,
    updatedAt: now,
  }
  await db.wrongQuestionStates.put(next)
}

export async function recordAnswer(sessionId: string, questionId: string, selectedAnswer: AnswerKey, durationSeconds: number): Promise<boolean> {
  const [session, question] = await Promise.all([db.practiceSessions.get(sessionId), db.questions.get(questionId)])
  if (!session || !question) throw new Error('练习记录或题目不存在')
  if (session.status !== 'active') throw new Error('本组练习已经交卷')
  const correct = selectedAnswer === question.answer
  const now = new Date().toISOString()
  await db.transaction('rw', db.attempts, db.practiceSessions, db.wrongQuestionStates, async () => {
    await db.attempts.put({ id: `${sessionId}:${questionId}`, sessionId, questionId, selectedAnswer, correct, durationSeconds, answeredAt: now })
    await db.practiceSessions.update(sessionId, {
      selectedAnswers: { ...session.selectedAnswers, [questionId]: selectedAnswer },
      submittedQuestionIds: [...new Set([...session.submittedQuestionIds, questionId])],
      updatedAt: now,
    })
    await updateWrongState(questionId, correct)
  })
  return correct
}

export async function completeExamSession(sessionId: string, answers: Record<string, AnswerKey>, elapsedSeconds: number): Promise<void> {
  const session = await db.practiceSessions.get(sessionId)
  if (!session) throw new Error('练习记录不存在')
  if (session.status !== 'active') return
  for (const questionId of session.questionIds) {
    const answer = answers[questionId]
    if (answer) await recordAnswer(sessionId, questionId, answer, Math.round(elapsedSeconds / Math.max(1, session.questionIds.length)))
  }
  const now = new Date().toISOString()
  await db.practiceSessions.update(sessionId, { status: 'completed', selectedAnswers: answers, elapsedSeconds, completedAt: now, updatedAt: now })
}

export async function finishInstantSession(sessionId: string, elapsedSeconds: number): Promise<void> {
  const now = new Date().toISOString()
  await db.practiceSessions.update(sessionId, { status: 'completed', elapsedSeconds, completedAt: now, updatedAt: now })
}

export async function toggleFavorite(questionId: string): Promise<boolean> {
  const current = await db.wrongQuestionStates.get(questionId)
  const now = new Date().toISOString()
  const next = !current?.isFavorite
  await db.wrongQuestionStates.put({
    questionId,
    isWrong: current?.isWrong ?? false,
    isFavorite: next,
    wrongCount: current?.wrongCount ?? 0,
    correctStreak: current?.correctStreak ?? 0,
    due: current?.due ?? now,
    updatedAt: now,
  })
  return next
}

function restoreCard(record?: ReviewCardRecord): Card {
  if (!record) return createEmptyCard()
  return {
    ...record.card,
    due: new Date(record.card.due),
    last_review: record.card.last_review ? new Date(record.card.last_review) : undefined,
  }
}

export async function rateReview(questionId: string, rating: Grade): Promise<string> {
  const previous = await db.reviewCards.get(questionId)
  const next = scheduler.next(restoreCard(previous), new Date(), rating).card
  const record: ReviewCardRecord = {
    questionId,
    card: { ...next, due: next.due.toISOString(), last_review: next.last_review?.toISOString() },
    lastRating: rating,
    updatedAt: new Date().toISOString(),
  }
  await db.transaction('rw', db.reviewCards, db.wrongQuestionStates, async () => {
    await db.reviewCards.put(record)
    const wrong = await db.wrongQuestionStates.get(questionId)
    if (wrong) await db.wrongQuestionStates.update(questionId, { due: record.card.due, updatedAt: record.updatedAt })
  })
  return record.card.due
}

export async function getDueQuestionIds(now = new Date()): Promise<string[]> {
  const states = (await db.wrongQuestionStates.toArray()).filter((state) => state.isWrong)
  return states.filter((state) => new Date(state.due) <= now).map((state) => state.questionId)
}

export { Rating }
