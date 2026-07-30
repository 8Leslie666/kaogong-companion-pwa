import { z } from 'zod'
import { parseQuestionPack } from '../domain/schemas'
import type { AnswerKey, Difficulty, ExamModule, ObjectiveQuestion, QuestionPack } from '../domain/types'

const answerKeys = ['A', 'B', 'C', 'D'] as const

const xzsItemSchema = z.object({
  prefix: z.string(),
  content: z.string(),
}).passthrough()

const xzsQuestionSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  questionType: z.coerce.number(),
  title: z.string(),
  items: z.array(xzsItemSchema),
  analyze: z.string().optional().default(''),
  correct: z.string(),
  difficult: z.coerce.number().optional().default(3),
}).passthrough()

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractRows(input: unknown): unknown[] {
  if (Array.isArray(input)) return input
  if (!isRecord(input)) return []
  if (Array.isArray(input.questions)) return input.questions
  if (Array.isArray(input.list)) return input.list
  if (Array.isArray(input.response)) return input.response
  if (isRecord(input.response) && Array.isArray(input.response.list)) return input.response.list
  return []
}

export function isXzsQuestionExport(input: unknown): boolean {
  const first = extractRows(input)[0]
  return isRecord(first) && 'questionType' in first && 'items' in first && 'correct' in first
}

function htmlToText(value: string): string {
  const entities: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (entity) => entities[entity] ?? entity)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function inferModule(text: string): ExamModule {
  if (/增长率|同比|环比|占比|比重|百分点|统计表|图表|材料中/.test(text)) return '资料分析'
  if (/工程问题|行程|路程|速度|排列组合|概率|利润|方程|数列|计算/.test(text)) return '数量关系'
  if (/文段|主旨|意在说明|填入|排序|词语|语句衔接|阅读理解/.test(text)) return '言语理解'
  if (/削弱|加强|推出|假设|前提|定义判断|类比|图形推理|逻辑/.test(text)) return '判断推理'
  if (/习近平|马克思|社会主义|中国共产党|治理体系|现代化/.test(text)) return '政治理论'
  return '常识判断'
}

function stableHash(text: string): string {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return (value >>> 0).toString(16).padStart(8, '0')
}

function slug(value: string): string {
  return value.replace(/\.[^.]+$/, '').trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '') || 'question-bank'
}

/**
 * Converts the single-choice JSON shape used by mindskip/xzs-mysql into the
 * app's stable QuestionPack contract. XZS remains an optional authoring/admin
 * upstream; the learner PWA keeps its local-first IndexedDB runtime.
 */
export function importXzsQuestionExport(input: unknown, fileName = 'xzs-export.json'): QuestionPack {
  const sourceRows = extractRows(input)
  const parsedRows = sourceRows.flatMap((row) => {
    const parsed = xzsQuestionSchema.safeParse(row)
    return parsed.success && parsed.data.questionType === 1 ? [parsed.data] : []
  })
  const fingerprint = stableHash(JSON.stringify(parsedRows))
  const packId = `xzs-${slug(fileName)}-${fingerprint}`
  const questions: ObjectiveQuestion[] = parsedRows.flatMap((row, index) => {
    const itemMap = new Map(row.items.map((item) => [item.prefix.trim().toUpperCase(), htmlToText(item.content)]))
    const answer = row.correct.trim().toUpperCase() as AnswerKey
    if (!answerKeys.includes(answer) || answerKeys.some((key) => !itemMap.get(key))) return []
    const stem = htmlToText(row.title)
    if (stem.length < 2) return []
    const module = inferModule(`${stem}\n${row.analyze}`)
    const difficulty = Math.min(5, Math.max(1, Math.round(row.difficult || 3))) as Difficulty
    return [{
      id: `${packId}-${row.id ?? index + 1}`,
      packId,
      module,
      submodule: module === '判断推理' ? '逻辑判断' : module === '言语理解' ? '片段阅读' : 'XZS 导入',
      stem,
      options: Object.fromEntries(answerKeys.map((key) => [key, itemMap.get(key)!])) as Record<AnswerKey, string>,
      answer,
      explanation: htmlToText(row.analyze) || `依据题干条件逐项判断，正确答案为 ${answer}。`,
      difficulty,
      source: `XZS 兼容导入 · ${fileName.replace(/\.[^.]+$/, '')}`,
      sourceUrl: 'https://github.com/mindskip/xzs-mysql',
      license: '题目内容沿用原来源条款；转换适配代码遵循本项目许可',
      tags: ['XZS', '兼容导入', module],
    }]
  })
  if (!questions.length) throw new Error('XZS 文件中没有可导入的四选一单选题')
  return parseQuestionPack({
    manifest: {
      schemaVersion: 1,
      packId,
      version: '1.0.0',
      title: `${fileName.replace(/\.[^.]+$/, '')}（XZS）`,
      license: '题目内容沿用原来源条款',
      sourceUrl: 'https://github.com/mindskip/xzs-mysql',
      checksum: `xzs-fnv1a-${fingerprint}`,
      builtIn: false,
    },
    questions,
  })
}

