import type { Card, Rating } from 'ts-fsrs'

export const EXAM_MODULES = ['政治理论', '常识判断', '言语理解', '数量关系', '判断推理', '资料分析'] as const
export type ExamModule = typeof EXAM_MODULES[number]
export type AnswerKey = 'A' | 'B' | 'C' | 'D'
export type Difficulty = 1 | 2 | 3 | 4 | 5
export type PracticeMode = 'instant' | 'exam' | 'review'
export type SessionStatus = 'active' | 'completed' | 'abandoned'
export type PositionType = '中央省级综合管理' | '市县综合管理' | '行政执法'

export interface QuestionPackManifest {
  schemaVersion: 1
  packId: string
  version: string
  title: string
  license: string
  sourceUrl: string
  checksum: string
  builtIn?: boolean
  installedAt?: string
}

export interface ObjectiveQuestion {
  id: string
  packId: string
  module: ExamModule
  submodule: string
  stem: string
  options: Record<AnswerKey, string>
  answer: AnswerKey
  explanation: string
  difficulty: Difficulty
  source: string
  sourceUrl: string
  license: string
  year?: number
  region?: string
  examType?: string
  variant?: string
  recallEdition?: boolean
  tags: string[]
  contentHash?: string
}

export interface QuestionPack {
  manifest: QuestionPackManifest
  questions: ObjectiveQuestion[]
}

export interface RubricItem {
  id: string
  label: string
  description: string
  maxScore: number
}

export interface EssayTask {
  id: string
  title: string
  prompt: string
  wordLimit: number
  referencePoints: string[]
  rubric: RubricItem[]
}

export interface EssayPaper {
  id: string
  packId: string
  title: string
  positionType: PositionType
  durationMinutes: number
  materials: Array<{ id: string; title: string; content: string }>
  tasks: EssayTask[]
  source: string
  license: string
}

export interface EssayPack {
  manifest: QuestionPackManifest
  essayPapers: EssayPaper[]
}

export interface PracticeSession {
  id: string
  mode: PracticeMode
  status: SessionStatus
  title: string
  questionIds: string[]
  selectedAnswers: Record<string, AnswerKey>
  submittedQuestionIds: string[]
  currentIndex: number
  elapsedSeconds: number
  startedAt: string
  updatedAt: string
  completedAt?: string
}

export interface Attempt {
  id: string
  sessionId: string
  questionId: string
  selectedAnswer: AnswerKey
  correct: boolean
  durationSeconds: number
  answeredAt: string
}

export interface WrongQuestionState {
  questionId: string
  isWrong: boolean
  isFavorite: boolean
  wrongCount: number
  correctStreak: number
  due: string
  updatedAt: string
}

export interface ReviewCardRecord {
  questionId: string
  card: Omit<Card, 'due' | 'last_review'> & { due: string; last_review?: string }
  lastRating?: Rating
  updatedAt: string
}

export interface EssaySubmission {
  id: string
  paperId: string
  taskId: string
  answerText: string
  elapsedSeconds: number
  checkedRubricIds: string[]
  selfScore: number
  status: 'draft' | 'submitted'
  createdAt: string
  updatedAt: string
  versions?: Array<{ savedAt: string; answerText: string; selfScore: number }>
}

export interface SettingRecord {
  key: string
  value: unknown
}

export interface BackupBundle {
  schemaVersion: 1
  exportedAt: string
  checksum: string
  data: {
    questionPacks: QuestionPackManifest[]
    userQuestions: ObjectiveQuestion[]
    userEssayPapers: EssayPaper[]
    practiceSessions: PracticeSession[]
    attempts: Attempt[]
    wrongQuestionStates: WrongQuestionState[]
    reviewCards: ReviewCardRecord[]
    essaySubmissions: EssaySubmission[]
    settings: SettingRecord[]
  }
}
