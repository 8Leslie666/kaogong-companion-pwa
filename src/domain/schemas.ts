import { z } from 'zod'
import { EXAM_MODULES, type EssayPack, type QuestionPack } from './types'

const answerKey = z.enum(['A', 'B', 'C', 'D'])

export const objectiveQuestionSchema = z.object({
  id: z.string().trim().min(1),
  packId: z.string().trim().min(1),
  module: z.enum(EXAM_MODULES),
  submodule: z.string().trim().min(1),
  stem: z.string().trim().min(2),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1), D: z.string().min(1) }),
  answer: answerKey,
  explanation: z.string().trim().min(2),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  source: z.string().trim().min(1),
  sourceUrl: z.string().url(),
  license: z.string().trim().min(1),
  year: z.number().int().min(2000).max(2100).optional(),
  region: z.string().optional(),
  examType: z.string().optional(),
  variant: z.string().optional(),
  recallEdition: z.boolean().optional(),
  tags: z.array(z.string()),
  contentHash: z.string().optional(),
})

export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  packId: z.string().trim().min(1),
  version: z.string().trim().min(1),
  title: z.string().trim().min(1),
  license: z.string().trim().min(1),
  sourceUrl: z.string().url(),
  checksum: z.string().trim().min(1),
  builtIn: z.boolean().optional(),
  installedAt: z.string().optional(),
})

const questionPackSchema = z.object({
  manifest: manifestSchema,
  questions: z.array(objectiveQuestionSchema).min(1),
})

const rubricItemSchema = z.object({ id: z.string().min(1), label: z.string().min(1), description: z.string().min(1), maxScore: z.number().nonnegative() })
const essayTaskSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), prompt: z.string().min(2), wordLimit: z.number().int().positive(),
  referencePoints: z.array(z.string().min(1)), rubric: z.array(rubricItemSchema).min(1),
})
export const essayPaperSchema = z.object({
  id: z.string().min(1), packId: z.string().min(1), title: z.string().min(1),
  positionType: z.enum(['中央省级综合管理', '市县综合管理', '行政执法']),
  durationMinutes: z.number().int().positive(),
  materials: z.array(z.object({ id: z.string().min(1), title: z.string().min(1), content: z.string().min(2) })).min(1),
  tasks: z.array(essayTaskSchema).min(1), source: z.string().min(1), license: z.string().min(1),
})

const essayPackSchema = z.object({ manifest: manifestSchema, essayPapers: z.array(essayPaperSchema).min(1) })

export function parseQuestionPack(input: unknown): QuestionPack {
  const parsed = questionPackSchema.parse(input) as QuestionPack
  const ids = new Set<string>()
  for (const question of parsed.questions) {
    if (ids.has(question.id)) throw new Error(`重复题目 ID：${question.id}`)
    if (question.packId !== parsed.manifest.packId) throw new Error(`题目 ${question.id} 的 packId 与清单不一致`)
    ids.add(question.id)
  }
  if (/\uFFFD|锟斤拷|烫烫烫/.test(JSON.stringify(parsed.questions))) throw new Error('检测到乱码，请确认文件使用 UTF-8 编码')
  return parsed
}

export function parseEssayPack(input: unknown): EssayPack {
  const parsed = essayPackSchema.parse(input) as EssayPack
  const ids = new Set<string>()
  for (const paper of parsed.essayPapers) {
    if (ids.has(paper.id)) throw new Error(`重复申论卷 ID：${paper.id}`)
    if (paper.packId !== parsed.manifest.packId) throw new Error(`申论卷 ${paper.id} 的 packId 与清单不一致`)
    ids.add(paper.id)
  }
  if (/\uFFFD|锟斤拷|烫烫烫/.test(JSON.stringify(parsed.essayPapers))) throw new Error('检测到乱码，请确认文件使用 UTF-8 编码')
  return parsed
}
