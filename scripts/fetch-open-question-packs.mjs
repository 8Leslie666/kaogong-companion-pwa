import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { read, utils } from 'xlsx'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'src/data/generated/openPacks.ts')
const keys = ['A', 'B', 'C', 'D']

function moduleFor(text, fallback = '常识判断') {
  if (/增长|比例|百分|平均|数据|统计|图表/.test(text)) return '资料分析'
  if (/路程|速度|工程|至少多少|共有多少|概率|排列|计算/.test(text)) return '数量关系'
  if (/主旨|意在|概括|填入|排序|文段|这段文字|词语/.test(text)) return '言语理解'
  if (/假设|推出|加强|削弱|类比|定义|逻辑|结论|前提/.test(text)) return '判断推理'
  if (/党|社会主义|现代化|马克思|治理|发展理念/.test(text)) return '政治理论'
  return fallback
}

function question({ id, packId, stem, options, answer, explanation, source, sourceUrl, license }) {
  const module = moduleFor(stem)
  return {
    id, packId, module, submodule: module === '判断推理' ? '逻辑判断' : module === '言语理解' ? '片段阅读' : '综合常识',
    stem, options: Object.fromEntries(keys.map((key, index) => [key, String(options[index] ?? '').replace(/^[A-D][.．、]\s*/, '')])),
    answer, explanation, difficulty: 3, source, sourceUrl, license, tags: [module, source, '开放题源'],
  }
}

async function fetchBytes(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${response.status} ${url}`)
    return Buffer.from(await response.arrayBuffer())
  } catch {
    console.warn(`fetch failed, retrying with curl: ${url}`)
    return execFileSync(process.platform === 'win32' ? 'curl.exe' : 'curl', ['-L', '--fail', '--retry', '3', '--max-time', '90', '--silent', '--show-error', url], { maxBuffer: 32 * 1024 * 1024 })
  }
}

function splitOptions(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  const match = text.match(/A[.．、:：]\s*(.*?)\s+B[.．、:：]\s*(.*?)\s+C[.．、:：]\s*(.*?)\s+D[.．、:：]\s*(.*)$/i)
  if (!match) return null
  return { prompt: text.slice(0, match.index).trim(), options: match.slice(1, 5).map((item) => item.trim()) }
}

async function fetchJson(url) {
  return JSON.parse((await fetchBytes(url)).toString('utf8'))
}

async function fetchText(url, encoding = 'utf-8') {
  const bytes = await fetchBytes(url)
  return new TextDecoder(encoding).decode(bytes)
}

async function cevalPack() {
  const base = 'https://datasets-server.huggingface.co/rows?dataset=ceval%2Fceval-exam&config=civil_servant'
  const [dev, val] = await Promise.all([fetchJson(`${base}&split=dev&offset=0&length=100`), fetchJson(`${base}&split=val&offset=0&length=100`)])
  const rows = [...dev.rows, ...val.rows].map((item) => item.row)
  const packId = 'ceval-civil-servant-open-v1'
  return {
    manifest: { schemaVersion: 1, packId, version: '1.0.0', title: 'C-Eval 公务员公开题', license: 'CC BY-NC-SA 4.0', sourceUrl: 'https://huggingface.co/datasets/ceval/ceval-exam/tree/main/civil_servant', checksum: `generated-ceval-${rows.length}`, builtIn: true },
    questions: rows.map((row, index) => question({ id: `ceval-cs-${index + 1}`, packId, stem: row.question, options: [row.A, row.B, row.C, row.D], answer: row.answer, explanation: row.explanation || `依据题意逐项比较，正确选项为${row.answer}。`, source: 'C-Eval civil_servant', sourceUrl: 'https://huggingface.co/datasets/ceval/ceval-exam/tree/main/civil_servant', license: 'CC BY-NC-SA 4.0' })),
  }
}

async function cmmluPack() {
  const base = 'https://raw.githubusercontent.com/haonan-li/CMMLU/master/data'
  const [devText, testText] = await Promise.all([fetchText(`${base}/dev/chinese_civil_service_exam.csv`), fetchText(`${base}/test/chinese_civil_service_exam.csv`)])
  const parse = (text) => utils.sheet_to_json(read(text, { type: 'string' }).Sheets.Sheet1, { defval: '' })
  const rows = [...parse(devText), ...parse(testText)]
  const packId = 'cmmlu-civil-service-open-v1'
  return {
    manifest: { schemaVersion: 1, packId, version: '1.0.0', title: 'CMMLU 中国公务员考试题', license: 'CC BY-NC 4.0', sourceUrl: 'https://huggingface.co/datasets/lmlmcat/cmmlu', checksum: `generated-cmmlu-${rows.length}`, builtIn: true },
    questions: rows.map((row, index) => question({ id: `cmmlu-cs-${index + 1}`, packId, stem: row.Question, options: keys.map((key) => row[key]), answer: row.Answer, explanation: `本题来自 CMMLU 中国公务员考试子集。依据题干条件与选项定义，答案为${row.Answer}；建议结合对应模块知识点复核其余选项。`, source: 'CMMLU Chinese Civil Service Exam', sourceUrl: 'https://huggingface.co/datasets/lmlmcat/cmmlu', license: 'CC BY-NC 4.0' })),
  }
}

async function logiqaPack() {
  // jsDelivr mirrors the GitHub repository and is considerably more stable for
  // the multi-megabyte training split on Windows than raw.githubusercontent.com.
  const base = 'https://cdn.jsdelivr.net/gh/csitfun/LogiQA2.0@main/logiqa/DATA/LOGIQA'
  const texts = await Promise.all(['dev_zh.txt', 'test_zh.txt', 'train_zh.txt'].map((name) => fetchText(`${base}/${name}`, 'utf-8')))
  const seen = new Set()
  const rows = texts.flatMap((text) => text.split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)] } catch { return [] }
  }))
    .filter((row) => Number.isInteger(row.answer) && row.answer >= 0 && row.answer <= 3 && String(row.text ?? '').trim().length > 1 && String(row.question ?? '').trim().length > 1 && Array.isArray(row.options) && row.options.length === 4 && row.options.every((option) => String(option ?? '').replace(/^[A-D][.．、]\s*/, '').trim().length > 0))
    .filter((row) => !seen.has(row.example_id) && seen.add(row.example_id))
    .slice(0, 1200)
  const packId = 'logiqa2-open-v1'
  return {
    manifest: { schemaVersion: 1, packId, version: '2.0.0', title: 'LogiQA 2.0 公考逻辑题库', license: 'CC BY-NC-SA 4.0', sourceUrl: 'https://github.com/csitfun/LogiQA2.0', checksum: `generated-logiqa2-${rows.length}`, builtIn: true },
    questions: rows.map((row) => question({ id: `logiqa2-${row.example_id}`, packId, stem: `${row.text}\n\n${row.question}`, options: row.options, answer: keys[row.answer], explanation: `先提取题干中的条件、结论与逻辑关系，再逐项代入排除。符合全部约束且最直接支持问题要求的是${keys[row.answer]}项。`, source: 'LogiQA 2.0', sourceUrl: 'https://github.com/csitfun/LogiQA2.0', license: 'CC BY-NC-SA 4.0' })),
  }
}

async function coigPack() {
  const localPath = process.env.COIG_EXAM_PATH
  let text
  if (localPath) {
    const { readFile } = await import('node:fs/promises')
    text = await readFile(localPath, 'utf8')
  } else {
    const url = 'https://huggingface.co/datasets/BAAI/COIG/resolve/main/exam_instructions.jsonl'
    const bytes = execFileSync(process.platform === 'win32' ? 'curl.exe' : 'curl', ['-L', '--fail', '--retry', '3', '--range', '0-18000000', '--silent', '--show-error', url], { maxBuffer: 22 * 1024 * 1024 })
    text = bytes.toString('utf8')
  }
  const limits = { '政治理论': 250, '常识判断': 350, '言语理解': 200 }
  const counts = { '政治理论': 0, '常识判断': 0, '言语理解': 0 }
  const selected = []
  const seen = new Set()
  for (const line of text.split(/\r?\n/)) {
    let row
    try { row = JSON.parse(line) } catch { continue }
    if (!keys.includes(row.textbox_answer)) continue
    const parsed = splitOptions(row.textbox_question)
    if (!parsed || parsed.options.some((item) => !item)) continue
    const subject = String(row.subject ?? '')
    const module = subject === '政治' ? '政治理论' : subject === '语文' ? '言语理解' : ['历史', '地理', '生物'].includes(subject) ? '常识判断' : null
    if (!module || counts[module] >= limits[module]) continue
    const context = Array.isArray(row.textbox_q_context) ? row.textbox_q_context.join('\n') : String(row.textbox_q_context ?? '')
    if (context.length > 900 || parsed.prompt.length > 500) continue
    const stem = `${context ? `${context}\n\n` : ''}${parsed.prompt}`.trim()
    const fingerprint = `${stem}\0${parsed.options.join('\0')}`
    if (stem.length < 4 || seen.has(fingerprint)) continue
    seen.add(fingerprint); counts[module] += 1
    selected.push({ ...row, module, stem, options: parsed.options })
    if (Object.entries(limits).every(([name, count]) => counts[name] >= count)) break
  }
  const packId = 'baai-coig-exam-open-v1'
  return {
    manifest: { schemaVersion: 1, packId, version: '1.0.0', title: 'COIG 公考综合能力精选', license: 'Apache-2.0 / source-specific terms', sourceUrl: 'https://huggingface.co/datasets/BAAI/COIG', checksum: `generated-coig-${selected.length}`, builtIn: true },
    questions: selected.map((row, index) => ({
      id: `coig-exam-${index + 1}`, packId, module: row.module,
      submodule: row.module === '政治理论' ? '政治素养' : row.module === '言语理解' ? '阅读理解' : `常识·${row.subject}`,
      stem: row.stem,
      options: Object.fromEntries(keys.map((key, optionIndex) => [key, row.options[optionIndex]])),
      answer: row.textbox_answer,
      explanation: typeof row.textbox_answer_analysis === 'string' && row.textbox_answer_analysis.trim().length > 8
        ? row.textbox_answer_analysis.trim()
        : `结合题干信息与${row.subject}相关知识逐项比较，符合题意的是${row.textbox_answer}项。`,
      difficulty: 3, source: 'BAAI COIG Exam Instructions', sourceUrl: 'https://huggingface.co/datasets/BAAI/COIG',
      license: 'Apache-2.0 / source-specific terms', tags: [row.module, row.subject, 'COIG', '开放题源'],
    })),
  }
}

const packs = await Promise.all([cevalPack(), cmmluPack(), logiqaPack(), coigPack()])
await mkdir(dirname(output), { recursive: true })
await writeFile(output, `/* Generated by scripts/fetch-open-question-packs.mjs. Do not edit by hand. */\nimport type { QuestionPack } from '../../domain/types'\n\nexport const openQuestionPacks = ${JSON.stringify(packs, null, 2)} as QuestionPack[]\n`, 'utf8')
console.log(JSON.stringify({ output, packs: packs.map((pack) => ({ id: pack.manifest.packId, questions: pack.questions.length })) }, null, 2))
