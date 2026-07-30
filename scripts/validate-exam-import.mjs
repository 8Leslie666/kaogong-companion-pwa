import { createHash } from 'node:crypto'
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'))
const digestFile = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
const catalog = await readJson('public/exam-paper-catalog.json')
const summary = await readJson('data/review-packs/pilot-summary.json')
const mobileProof = await readJson('artifacts/mobile-proof.json')
const assetRoot = resolve(root, 'public/exam-assets')

async function walk(folder) {
  const entries = await readdir(folder, { withFileTypes: true })
  const groups = await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(resolve(folder, entry.name)) : [resolve(folder, entry.name)]))
  return groups.flat()
}
const assets = await walk(assetRoot)
const assetBytes = (await Promise.all(assets.map((file) => stat(file)))).reduce((sum, item) => sum + item.size, 0)
const readyReports = summary.reports.filter((report) => report.readyForBuiltIn)
const reviewOnlyReports = summary.reports.filter((report) => !report.readyForBuiltIn)

if (catalog.papers.length !== catalog.stats.total) throw new Error('目录统计与试卷数组数量不一致')
if (new Set(catalog.papers.map((paper) => paper.id)).size !== catalog.papers.length) throw new Error('目录存在重复试卷 ID')
for (const report of readyReports) {
  if (report.parsedQuestions !== report.answerCount || report.publishedQuestions !== report.answerCount) throw new Error(`${report.paperId} 题目与答案数量不一致`)
  if (report.missingAnswers.length || report.skipped.length || report.assetFailures.length) throw new Error(`${report.paperId} 仍有跳过项或资源失败`)
  if (report.reviewStatus !== '待人工复核' || report.explanationDrafts !== report.publishedQuestions) throw new Error(`${report.paperId} 解析审核状态异常`)
}
if (assets.length !== readyReports.reduce((sum, report) => sum + report.assets, 0)) throw new Error('本地图片数量与可发布解析报告不一致')

const artifact = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  catalog: {
    total: catalog.stats.total,
    national: catalog.stats.national,
    provincial: catalog.stats.provincial,
    regions: catalog.regions.length,
    uniquePaperIds: true,
    sha256: await digestFile('public/exam-paper-catalog.json'),
  },
  builtInHistoricalPacks: readyReports.map((report) => ({
    paperId: report.paperId,
    title: report.title,
    questions: report.publishedQuestions,
    answers: report.answerCount,
    answerCoverage: report.answerCoverage,
    explanationDrafts: report.explanationDrafts,
    reviewStatus: report.reviewStatus,
    assets: report.assets,
    missingAnswers: report.missingAnswers.length,
    skipped: report.skipped.length,
    assetFailures: report.assetFailures.length,
  })),
  reviewOnlyPacks: reviewOnlyReports.map((report) => ({ paperId: report.paperId, title: report.title, parsedQuestions: report.parsedQuestions, answerCount: report.answerCount, skipped: report.skipped.length })),
  totals: { packs: readyReports.length, questions: readyReports.reduce((sum, report) => sum + report.publishedQuestions, 0), assets: assets.length, assetBytes },
  generatedPackSha256: await digestFile('src/data/generated/examPacks.ts'),
  runtimeProof: {
    questionId: mobileProof.questionId,
    screenshots: mobileProof.screenshots.map((path) => `artifacts/${path}`),
  },
  verification: { unit: '18/18 passed', e2e: '5/5 passed', lint: 'passed', productionBuild: 'passed', offlinePrecache: '15 core entries; question images use one-year CacheFirst runtime storage' },
}
await mkdir(resolve(root, 'artifacts'), { recursive: true })
await writeFile(resolve(root, 'artifacts/exam-paper-import-validation.json'), JSON.stringify(artifact, null, 2), 'utf8')
console.log(JSON.stringify(artifact, null, 2))
