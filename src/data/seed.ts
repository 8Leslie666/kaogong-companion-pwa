import { essayPapers } from './essayPapers'
import { originalPackId, originalQuestions } from './originalQuestions'
import type { QuestionPackManifest } from '../domain/types'

export const builtInManifest: QuestionPackManifest = {
  schemaVersion: 1,
  packId: originalPackId,
  version: '1.0.0',
  title: '2026 行测与申论原创基础包',
  license: '原创内容，仅供学习使用',
  sourceUrl: 'https://www.forestry.gov.cn/c/www/gsgg/645383.jhtml',
  checksum: 'builtin-original-core-v1-180q-6e',
  builtIn: true,
  installedAt: '2026-07-29T00:00:00.000Z',
}

export const builtInContent = { manifest: builtInManifest, questions: originalQuestions, essayPapers }
export async function loadBuiltInPacks() {
  const [{ openQuestionPacks }, { examQuestionPacks }] = await Promise.all([
    import('./generated/openPacks'),
    import('./generated/examPacks'),
  ])
  return [{ manifest: builtInManifest, questions: originalQuestions }, ...openQuestionPacks, ...examQuestionPacks]
}
