import { parseEssayPack, parseQuestionPack } from '../domain/schemas'
import { importXzsQuestionExport, isXzsQuestionExport } from '../integrations/xzs'
import { db } from '../db/database'
import type { AnswerKey, EssayPack, ExamModule, ObjectiveQuestion, QuestionPack } from '../domain/types'

type Row = Record<string, unknown>
const value = (row: Row, ...keys: string[]) => keys.map((key) => row[key]).find((item) => item !== undefined && item !== '')

export async function importJsonPack(text: string, fileName = 'question-pack.json'): Promise<QuestionPack> {
  const input: unknown = JSON.parse(text)
  return isXzsQuestionExport(input) ? importXzsQuestionExport(input, fileName) : parseQuestionPack(input)
}

export async function importJsonEssayPack(text: string): Promise<EssayPack> {
  return parseEssayPack(JSON.parse(text))
}

export async function importXlsxPack(buffer: ArrayBuffer, fileName: string): Promise<QuestionPack> {
  const { read, utils } = await import('xlsx')
  const workbook = read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = utils.sheet_to_json<Row>(sheet, { defval: '' })
  const packId = `user-${fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-')}-${Date.now()}`
  const questions: ObjectiveQuestion[] = rows.map((row, index) => ({
    id: String(value(row, 'id', '题目ID') || `${packId}-${index + 1}`), packId,
    module: String(value(row, 'module', '模块')) as ExamModule,
    submodule: String(value(row, 'submodule', '子类') || '自定义'),
    stem: String(value(row, 'stem', '题干')),
    options: { A: String(value(row, 'A', '选项A')), B: String(value(row, 'B', '选项B')), C: String(value(row, 'C', '选项C')), D: String(value(row, 'D', '选项D')) },
    answer: String(value(row, 'answer', '答案')).toUpperCase() as AnswerKey,
    explanation: String(value(row, 'explanation', '解析') || '用户导入题目，解析待补充。'),
    difficulty: Number(value(row, 'difficulty', '难度') || 3) as 1 | 2 | 3 | 4 | 5,
    source: String(value(row, 'source', '来源') || fileName),
    sourceUrl: String(value(row, 'sourceUrl', '来源链接') || 'https://example.com/user-import'),
    license: String(value(row, 'license', '许可') || '用户自有内容'),
    year: value(row, 'year', '年份') ? Number(value(row, 'year', '年份')) : undefined,
    region: String(value(row, 'region', '地区') || ''),
    tags: String(value(row, 'tags', '标签') || '').split(/[,，;；]/).map((item) => item.trim()).filter(Boolean),
  }))
  return parseQuestionPack({
    manifest: { schemaVersion: 1, packId, version: '1.0.0', title: fileName.replace(/\.[^.]+$/, ''), license: '用户自有内容', sourceUrl: 'https://example.com/user-import', checksum: `local-${packId}`, builtIn: false },
    questions,
  })
}

export async function saveQuestionPack(pack: QuestionPack): Promise<number> {
  const existingIds = new Set((await db.questions.bulkGet(pack.questions.map((question) => question.id))).filter(Boolean).map((question) => question!.id))
  if (existingIds.size > 0) throw new Error(`检测到 ${existingIds.size} 个重复题目 ID，请修改后重试`)
  await db.transaction('rw', db.questionPacks, db.questions, async () => {
    await db.questionPacks.put({ ...pack.manifest, builtIn: false, installedAt: new Date().toISOString() })
    await db.questions.bulkAdd(pack.questions)
  })
  return pack.questions.length
}

export async function saveEssayPack(pack: EssayPack): Promise<number> {
  const existingIds = new Set((await db.essayPapers.bulkGet(pack.essayPapers.map((paper) => paper.id))).filter(Boolean).map((paper) => paper!.id))
  if (existingIds.size > 0) throw new Error(`检测到 ${existingIds.size} 个重复申论卷 ID，请修改后重试`)
  await db.transaction('rw', db.questionPacks, db.essayPapers, async () => {
    await db.questionPacks.put({ ...pack.manifest, builtIn: false, installedAt: new Date().toISOString() })
    await db.essayPapers.bulkAdd(pack.essayPapers)
  })
  return pack.essayPapers.length
}
