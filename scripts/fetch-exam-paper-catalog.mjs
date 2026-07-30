import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'public/exam-paper-catalog.json')
const rawDir = resolve(root, 'data/source-catalog/raw')
const api = 'https://gwy.gkzhenti.cn/api/json'

const regions = [
  '国考', '北京', '上海', '天津', '重庆', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西',
  '海南', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆', '深圳', '广州',
]

async function fetchBytes(url) {
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'KaogongCompanionCatalog/1.0 (+local PWA)' } })
    if (!response.ok) throw new Error(`${response.status} ${url}`)
    return Buffer.from(await response.arrayBuffer())
  } catch {
    return execFileSync(process.platform === 'win32' ? 'curl.exe' : 'curl', [
      '-L', '--fail', '--retry', '3', '--retry-delay', '1', '--max-time', '60', '--silent', '--show-error', url,
    ], { maxBuffer: 16 * 1024 * 1024 })
  }
}

function variantFor(title) {
  return title.match(/行政执法卷|行政执法|副省级|省部级|地市级|市地级|县乡卷|乡镇卷|[ABC]类|[ABC]卷/)?.[0] ?? '综合卷'
}

async function fetchRegion(region) {
  const url = `${api}?cls=${encodeURIComponent('行测')}&province=${encodeURIComponent(region)}`
  const rows = JSON.parse((await fetchBytes(url)).toString('utf8'))
  await mkdir(rawDir, { recursive: true })
  await writeFile(resolve(rawDir, `${region}.json`), JSON.stringify(rows, null, 2), 'utf8')
  return rows.map((row) => {
    const title = String(row.Title ?? '').trim()
    const year = Number(title.match(/(20\d{2})年/)?.[1] ?? 0)
    const id = String(row.No ?? '').match(/\/paper\/([^/?#]+)/)?.[1] ?? ''
    return {
      id,
      title,
      url: String(row.No ?? ''),
      answerUrl: id ? `https://gwy.gkzhenti.cn/answer/${id}` : '',
      explanationUrl: id ? `https://gwy.gkzhenti.cn/explain/${id}` : '',
      examType: region === '国考' ? '国考' : '省考',
      region,
      year,
      variant: variantFor(title),
      recallEdition: /回忆/.test(title),
      source: String(row.Source ?? '公开真题库'),
    }
  }).filter((row) => row.id && row.title && row.year)
}

const collected = []
for (let index = 0; index < regions.length; index += 4) {
  const batch = regions.slice(index, index + 4)
  const results = await Promise.all(batch.map(async (region) => {
    try { return await fetchRegion(region) }
    catch (error) { console.warn(`${region}: ${error instanceof Error ? error.message : error}`); return [] }
  }))
  collected.push(...results.flat())
}

const deduped = [...new Map(collected.map((row) => [row.id, row])).values()]
  .sort((left, right) => right.year - left.year || left.region.localeCompare(right.region, 'zh-CN') || left.title.localeCompare(right.title, 'zh-CN'))

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceApi: 'https://gwy.gkzhenti.cn/api',
  terms: '公开目录索引；试卷正文及题目内容沿用各自来源条款',
  regions,
  stats: {
    total: deduped.length,
    national: deduped.filter((row) => row.examType === '国考').length,
    provincial: deduped.filter((row) => row.examType === '省考').length,
    byRegion: Object.fromEntries(regions.map((region) => [region, deduped.filter((row) => row.region === region).length])),
  },
  papers: deduped,
}

await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify(payload, null, 2), 'utf8')
console.log(JSON.stringify({ output, ...payload.stats }, null, 2))

