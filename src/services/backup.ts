import { z } from 'zod'
import { db } from '../db/database'
import type { BackupBundle } from '../domain/types'
import { essayPaperSchema, manifestSchema, objectiveQuestionSchema } from '../domain/schemas'

const envelopeSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  checksum: z.string().min(1),
  data: z.object({
    questionPacks: z.array(manifestSchema), userQuestions: z.array(objectiveQuestionSchema), userEssayPapers: z.array(essayPaperSchema), practiceSessions: z.array(z.object({ id: z.string() }).passthrough()),
    attempts: z.array(z.object({ id: z.string() }).passthrough()), wrongQuestionStates: z.array(z.object({ questionId: z.string() }).passthrough()), reviewCards: z.array(z.object({ questionId: z.string() }).passthrough()),
    essaySubmissions: z.array(z.object({ id: z.string() }).passthrough()), settings: z.array(z.object({ key: z.string() }).passthrough()),
  }),
})

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createBackupBundle(): Promise<BackupBundle> {
  const [questionPacks, questions, essayPapers, practiceSessions, attempts, wrongQuestionStates, reviewCards, essaySubmissions, settings] = await Promise.all([
    db.questionPacks.toArray(), db.questions.toArray(), db.essayPapers.toArray(), db.practiceSessions.toArray(), db.attempts.toArray(),
    db.wrongQuestionStates.toArray(), db.reviewCards.toArray(), db.essaySubmissions.toArray(), db.settings.toArray(),
  ])
  const userPackIds = new Set(questionPacks.filter((pack) => !pack.builtIn).map((pack) => pack.packId))
  const data: BackupBundle['data'] = {
    questionPacks: questionPacks.filter((pack) => !pack.builtIn),
    userQuestions: questions.filter((question) => userPackIds.has(question.packId)),
    userEssayPapers: essayPapers.filter((paper) => userPackIds.has(paper.packId)),
    practiceSessions, attempts, wrongQuestionStates, reviewCards, essaySubmissions, settings,
  }
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), checksum: await sha256(JSON.stringify(data)), data }
}

export async function parseBackupBundle(text: string): Promise<BackupBundle> {
  const parsed = envelopeSchema.parse(JSON.parse(text)) as unknown as BackupBundle
  const actual = await sha256(JSON.stringify(parsed.data))
  if (actual !== parsed.checksum) throw new Error('备份校验和不一致，文件可能已损坏')
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) throw new Error(`备份中存在重复${label} ID`)
  }
  unique(parsed.data.questionPacks.map((item) => item.packId), '题包')
  unique(parsed.data.userQuestions.map((item) => item.id), '题目')
  unique(parsed.data.userEssayPapers.map((item) => item.id), '申论卷')
  unique(parsed.data.practiceSessions.map((item) => item.id), '练习')
  unique(parsed.data.attempts.map((item) => item.id), '答题记录')
  unique(parsed.data.essaySubmissions.map((item) => item.id), '申论稿件')
  return parsed
}

export async function restoreBackupBundle(bundle: BackupBundle): Promise<void> {
  await db.transaction('rw', [db.questionPacks, db.questions, db.essayPapers, db.practiceSessions, db.attempts, db.wrongQuestionStates, db.reviewCards, db.essaySubmissions, db.settings], async () => {
    await db.questionPacks.bulkPut(bundle.data.questionPacks)
    await db.questions.bulkPut(bundle.data.userQuestions)
    await db.essayPapers.bulkPut(bundle.data.userEssayPapers)
    await db.practiceSessions.bulkPut(bundle.data.practiceSessions)
    await db.attempts.bulkPut(bundle.data.attempts)
    await db.wrongQuestionStates.bulkPut(bundle.data.wrongQuestionStates)
    await db.reviewCards.bulkPut(bundle.data.reviewCards)
    await db.essaySubmissions.bulkPut(bundle.data.essaySubmissions)
    await db.settings.bulkPut(bundle.data.settings)
  })
  await db.settings.put({ key: 'lastBackupAt', value: new Date().toISOString() })
}

export function downloadBackup(bundle: BackupBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `考公陪跑宝典-备份-${bundle.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}
