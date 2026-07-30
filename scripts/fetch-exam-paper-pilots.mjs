import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { load } from 'cheerio'
import TurndownService from 'turndown'

const root = resolve(import.meta.dirname, '..')
const catalogPath = resolve(root, 'public/exam-paper-catalog.json')
const reviewDir = resolve(root, 'data/review-packs')
const assetsRoot = resolve(root, 'public/exam-assets')
const generatedOutput = resolve(root, 'src/data/generated/examPacks.ts')
const defaultIds = ['1735356969686', '1739531137130'] // 2025 国考副省级、2025 浙江 A 类
const cliArgs = process.argv.slice(2)
const regionIndex = cliArgs.indexOf('--region')
const selectedRegion = regionIndex >= 0 ? cliArgs[regionIndex + 1] : undefined
const selectedIds = cliArgs.filter((value, index) => !value.startsWith('--') && index !== regionIndex + 1)
const baseUrl = 'https://gwy.gkzhenti.cn'
const answerKeys = ['A', 'B', 'C', 'D']

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*' })
turndown.addRule('lineBreak', { filter: 'br', replacement: () => '\n' })

async function fetchBytes(url) {
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'KaogongCompanionPaperImporter/1.0 (+local PWA)' } })
    if (!response.ok) throw new Error(`${response.status} ${url}`)
    return { bytes: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') ?? '' }
  } catch {
    const bytes = execFileSync(process.platform === 'win32' ? 'curl.exe' : 'curl', [
      '-L', '--fail', '--retry', '3', '--retry-delay', '1', '--max-time', '90', '--silent', '--show-error', url,
    ], { maxBuffer: 32 * 1024 * 1024 })
    return { bytes, contentType: '' }
  }
}

async function fetchText(url) {
  return (await fetchBytes(url)).bytes.toString('utf8')
}

function cleanMarkdown(value) {
  return value
    .replace(/\\([.!])/g, '$1')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function moduleForSection(section, fallbackText = '') {
  if (/政治理论/.test(section)) return '政治理论'
  if (/常识判断/.test(section)) return '常识判断'
  if (/言语理解/.test(section)) return '言语理解'
  if (/数量关系/.test(section)) return '数量关系'
  if (/判断推理/.test(section)) return '判断推理'
  if (/资料分析/.test(section)) return '资料分析'
  if (/增长|比重|百分点|同比|环比|图表/.test(fallbackText)) return '资料分析'
  if (/削弱|加强|推出|定义判断|类比|图形推理/.test(fallbackText)) return '判断推理'
  if (/主旨|意在说明|填入|排序|文段/.test(fallbackText)) return '言语理解'
  if (/概率|排列|工程|行程|方程|计算/.test(fallbackText)) return '数量关系'
  return '常识判断'
}

function submoduleFor(module, text) {
  if (module === '判断推理') {
    if (/图形/.test(text)) return '图形推理'
    if (/定义/.test(text)) return '定义判断'
    if (/类比/.test(text)) return '类比推理'
    return '逻辑判断'
  }
  if (module === '言语理解') return /填入|词语|成语/.test(text) ? '逻辑填空' : '片段阅读'
  if (module === '数量关系') return '数学运算'
  if (module === '资料分析') return '综合资料'
  if (module === '政治理论') return '政治素养'
  return '综合常识'
}

function digest(value, algorithm = 'sha256', length) {
  const hash = createHash(algorithm).update(value).digest('hex')
  return length ? hash.slice(0, length) : hash
}

function imageExtension(url, contentType = '') {
  const suffix = extname(new URL(url).pathname).toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(suffix)) return suffix
  if (/jpeg/.test(contentType)) return '.jpg'
  if (/gif/.test(contentType)) return '.gif'
  if (/webp/.test(contentType)) return '.webp'
  return '.png'
}

function createAssetRegistry(paperId) {
  const assets = new Map()
  return {
    localize(html) {
      const fragment = load(`<div id="asset-root">${html}</div>`, null, false)
      fragment('#asset-root img').each((_, element) => {
        const source = fragment(element).attr('src')
        if (!source) return
        const remoteUrl = new URL(source, baseUrl).toString()
        const key = digest(remoteUrl, 'sha1', 14)
        const suffix = imageExtension(remoteUrl)
        const localPath = `exam-assets/${paperId}/${key}${suffix}`
        assets.set(remoteUrl, { remoteUrl, localPath })
        fragment(element).attr('src', localPath).attr('alt', fragment(element).attr('alt') || '题图')
      })
      return fragment('#asset-root').html() ?? ''
    },
    entries: assets,
  }
}

function parseAnswers(html) {
  const $ = load(html)
  const text = $('#printcontent').length ? $('#printcontent').text() : $('body').text()
  return new Map([...text.matchAll(/(\d+)\s*[、.．]\s*([A-D])/g)].map((match) => [Number(match[1]), match[2]]))
}

function parsePaper(html, entry) {
  const $ = load(html)
  const assetRegistry = createAssetRegistry(entry.id)
  const title = cleanMarkdown($('#printcontent > h3').first().text()) || entry.title
  const questions = []
  const skipped = []
  let section = ''
  let sharedContext = ''

  $('#printcontent > div > .row').each((_, row) => {
    const current = $(row)
    const subtitle = cleanMarkdown(current.find('.subtitle').first().text())
    if (subtitle) {
      section = subtitle
      sharedContext = ''
      return
    }
    const numberText = cleanMarkdown(current.children('.left').first().text())
    const number = /^\d+$/.test(numberText) ? Number(numberText) : 0
    const right = current.children('.right').first()
    const rawContent = right.length ? right.html() ?? '' : current.html() ?? ''
    if (!number) {
      const candidate = cleanMarkdown(turndown.turndown(assetRegistry.localize(rawContent)))
      if (candidate && !/^[（(][一二三四五六七八九十]+[）)]$/.test(candidate)) sharedContext = candidate
      else if (candidate && sharedContext) sharedContext = `${sharedContext}\n\n${candidate}`
      return
    }

    const fragment = load(`<div id="question-root">${assetRegistry.localize(rawContent)}</div>`, null, false)
    const optionNodes = []
    const options = {}
    fragment('#question-root').children('div, p').each((__, element) => {
      const node = fragment(element)
      const text = cleanMarkdown(node.text())
      const match = text.match(/^([A-D])[、.．]\s*/)
      if (!match || options[match[1]]) return
      const key = match[1]
      const htmlValue = node.html() ?? ''
      const withoutPrefix = htmlValue.replace(/^\s*[A-D][、.．]\s*/, '')
      options[key] = cleanMarkdown(turndown.turndown(withoutPrefix))
      optionNodes.push(element)
    })
    optionNodes.forEach((element) => fragment(element).remove())
    const ownStem = cleanMarkdown(turndown.turndown(fragment('#question-root').html() ?? ''))
    const stem = cleanMarkdown([sharedContext, ownStem].filter(Boolean).join('\n\n'))
    if (!stem || answerKeys.some((key) => !options[key])) {
      skipped.push({ number, reason: !stem ? 'empty-stem' : 'missing-options', optionKeys: Object.keys(options) })
      return
    }
    questions.push({ number, section, stem, options })
  })
  return { title, questions, skipped, assets: assetRegistry.entries }
}

async function downloadAssets(paperId, assets) {
  const outputDir = resolve(assetsRoot, paperId)
  await mkdir(outputDir, { recursive: true })
  const failures = []
  for (const asset of assets.values()) {
    try {
      const response = await fetchBytes(asset.remoteUrl)
      const actualExtension = imageExtension(asset.remoteUrl, response.contentType)
      const expectedExtension = extname(asset.localPath)
      const localPath = actualExtension === expectedExtension ? asset.localPath : asset.localPath.slice(0, -expectedExtension.length) + actualExtension
      await writeFile(resolve(root, 'public', localPath), response.bytes)
      if (localPath !== asset.localPath) asset.localPath = localPath
    } catch (error) {
      failures.push({ url: asset.remoteUrl, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return failures
}

function variantLabel(entry) {
  return entry.variant === '综合卷' ? '' : entry.variant
}

async function buildPack(entry) {
  const [paperHtml, answerHtml] = await Promise.all([fetchText(entry.url), fetchText(entry.answerUrl)])
  const parsed = parsePaper(paperHtml, entry)
  const answers = parseAnswers(answerHtml)
  const assetFailures = await downloadAssets(entry.id, parsed.assets)
  const packId = `gkzhenti-${entry.id}`
  const duplicateHashes = new Set()
  const missingAnswers = []
  const questions = parsed.questions.flatMap((row) => {
    const answer = answers.get(row.number)
    if (!answer) { missingAnswers.push(row.number); return [] }
    const module = moduleForSection(row.section, row.stem)
    const contentHash = digest(JSON.stringify([row.stem, row.options]))
    if (duplicateHashes.has(contentHash)) return []
    duplicateHashes.add(contentHash)
    return [{
      id: `${packId}-q-${String(row.number).padStart(3, '0')}`,
      packId,
      module,
      submodule: submoduleFor(module, row.stem),
      stem: row.stem,
      options: row.options,
      answer,
      explanation: `来源答案页给出的参考答案为 ${answer}。本题属于${entry.year}年${entry.region}${variantLabel(entry)}回忆整理题，建议结合题干条件与对应模块知识点逐项复核。`,
      difficulty: 3,
      year: entry.year,
      region: entry.region,
      examType: entry.examType,
      variant: entry.variant,
      recallEdition: entry.recallEdition,
      source: `公开真题库 · ${entry.source}`,
      sourceUrl: entry.url,
      license: '公开网页整理 / 来源特定条款',
      tags: [...new Set(['历年真题', entry.examType, entry.region, String(entry.year), entry.variant, entry.recallEdition ? '网友回忆版' : '历年试卷', '解析草稿'])],
      contentHash,
    }]
  })
  const checksum = digest(JSON.stringify(questions))
  const pack = {
    manifest: {
      schemaVersion: 1,
      packId,
      version: `${entry.year}.1.0`,
      title: parsed.title,
      license: '公开网页整理 / 来源特定条款',
      sourceUrl: entry.url,
      checksum: `sha256-${checksum}`,
      builtIn: true,
    },
    questions,
  }
  const report = {
    paperId: entry.id,
    title: parsed.title,
    entry,
    parsedQuestions: parsed.questions.length,
    answerCount: answers.size,
    publishedQuestions: questions.length,
    answerCoverage: questions.length ? 1 : 0,
    explanationCoverage: 0,
    explanationDrafts: questions.length,
    reviewStatus: '待人工复核',
    skipped: parsed.skipped,
    missingAnswers,
    assets: parsed.assets.size,
    assetFailures,
    modules: Object.fromEntries([...new Set(questions.map((question) => question.module))].map((module) => [module, questions.filter((question) => question.module === module).length])),
  }
  report.readyForBuiltIn = report.parsedQuestions === report.answerCount
    && report.publishedQuestions === report.answerCount
    && report.skipped.length === 0
    && report.missingAnswers.length === 0
    && report.assetFailures.length === 0
  await mkdir(reviewDir, { recursive: true })
  await writeFile(resolve(reviewDir, `${entry.id}.json`), JSON.stringify({ pack, report }, null, 2), 'utf8')
  return { pack, report }
}

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const regionalIds = selectedRegion ? catalog.papers.filter((entry) => entry.region === selectedRegion).map((entry) => entry.id) : []
const paperIds = [...new Set([...defaultIds, ...selectedIds, ...regionalIds])]
const entries = paperIds.map((id) => catalog.papers.find((entry) => entry.id === id)).filter(Boolean)
if (entries.length !== paperIds.length) throw new Error(`目录中有试卷 ID 未找到：${paperIds.filter((id) => !entries.some((entry) => entry.id === id)).join(', ')}`)

const results = []
for (const entry of entries) results.push(await buildPack(entry))
const publishable = results.filter((result) => result.report.readyForBuiltIn)
const reviewOnly = results.filter((result) => !result.report.readyForBuiltIn)
for (const result of reviewOnly) await rm(resolve(assetsRoot, result.report.paperId), { recursive: true, force: true })
await mkdir(resolve(root, 'src/data/generated'), { recursive: true })
await writeFile(generatedOutput, `/* Generated by scripts/fetch-exam-paper-pilots.mjs. */\nimport type { QuestionPack } from '../../domain/types'\n\nexport const examQuestionPacks = ${JSON.stringify(publishable.map((result) => result.pack), null, 2)} as QuestionPack[]\n`, 'utf8')
await writeFile(resolve(reviewDir, 'pilot-summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), reports: results.map((result) => result.report) }, null, 2), 'utf8')
console.log(JSON.stringify({ output: generatedOutput, publishedPacks: publishable.length, publishedQuestions: publishable.reduce((sum, result) => sum + result.pack.questions.length, 0), reviewOnlyPacks: reviewOnly.map((result) => ({ paperId: result.report.paperId, title: result.report.title })), reports: results.map((result) => result.report) }, null, 2))
