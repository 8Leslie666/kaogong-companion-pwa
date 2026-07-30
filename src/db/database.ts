import Dexie, { type EntityTable } from 'dexie'
import type {
  Attempt,
  EssayPaper,
  EssaySubmission,
  ObjectiveQuestion,
  PracticeSession,
  QuestionPackManifest,
  ReviewCardRecord,
  SettingRecord,
  WrongQuestionState,
} from '../domain/types'
import { builtInContent, loadBuiltInPacks } from '../data/seed'

export class KaogongDatabase extends Dexie {
  questionPacks!: EntityTable<QuestionPackManifest, 'packId'>
  questions!: EntityTable<ObjectiveQuestion, 'id'>
  essayPapers!: EntityTable<EssayPaper, 'id'>
  practiceSessions!: EntityTable<PracticeSession, 'id'>
  attempts!: EntityTable<Attempt, 'id'>
  wrongQuestionStates!: EntityTable<WrongQuestionState, 'questionId'>
  reviewCards!: EntityTable<ReviewCardRecord, 'questionId'>
  essaySubmissions!: EntityTable<EssaySubmission, 'id'>
  settings!: EntityTable<SettingRecord, 'key'>

  constructor(name = 'kaogong-companion') {
    super(name)
    this.version(1).stores({
      questionPacks: 'packId, version, builtIn, installedAt',
      questions: 'id, packId, module, submodule, difficulty, source, *tags',
      essayPapers: 'id, packId, positionType',
      practiceSessions: 'id, status, mode, startedAt, updatedAt, completedAt',
      attempts: 'id, sessionId, questionId, answeredAt, correct, [sessionId+questionId]',
      wrongQuestionStates: 'questionId, isWrong, isFavorite, due, updatedAt',
      reviewCards: 'questionId, updatedAt',
      essaySubmissions: 'id, paperId, taskId, status, updatedAt, [paperId+taskId]',
      settings: 'key',
    })
  }
}

export const db = new KaogongDatabase()

export async function ensureSeedData(database: KaogongDatabase = db): Promise<void> {
  const builtInPacks = await loadBuiltInPacks()
  const installed = await database.questionPacks.bulkGet(builtInPacks.map((pack) => pack.manifest.packId))
  const current = builtInPacks.every((pack, index) => installed[index]?.version === pack.manifest.version)
  if (current) return
  await database.transaction('rw', database.questionPacks, database.questions, database.essayPapers, async () => {
    const installedAt = new Date().toISOString()
    await database.questionPacks.bulkPut(builtInPacks.map((pack) => ({ ...pack.manifest, builtIn: true, installedAt })))
    await database.questions.bulkPut(builtInPacks.flatMap((pack) => pack.questions))
    await database.essayPapers.bulkPut(builtInContent.essayPapers)
  })
}
