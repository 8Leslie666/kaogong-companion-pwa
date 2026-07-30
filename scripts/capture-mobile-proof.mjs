import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const root = process.cwd()
const output = resolve(root, 'artifacts')
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
await mkdir(output, { recursive: true })

const browser = await chromium.launch(existsSync(chrome) ? { executablePath: chrome } : {})
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, locale: 'zh-CN' })
const page = await context.newPage()
await page.goto('http://127.0.0.1:4174/')
await page.getByRole('button', { name: '刷题' }).click()
await page.getByText('4287 道可用').waitFor()
const filters = page.locator('.filter-panel')
await filters.getByRole('button', { name: '贵州', exact: true }).click()
await page.getByText('1630 道可用').waitFor()
await filters.getByRole('button', { name: '2026', exact: true }).click()
await page.getByText('110 道可用').waitFor()
await filters.screenshot({ path: resolve(output, 'mobile-guizhou-filters.png') })

const questionId = await page.evaluate(async () => {
  const database = await new Promise((resolveOpen, reject) => {
    const request = indexedDB.open('kaogong-companion')
    request.onsuccess = () => resolveOpen(request.result)
    request.onerror = () => reject(request.error)
  })
  const db = /** @type {IDBDatabase} */ (database)
  const question = await new Promise((resolveQuestion, reject) => {
    const request = db.transaction('questions').objectStore('questions').getAll()
    request.onsuccess = () => resolveQuestion(request.result.find((item) => item.packId === 'gkzhenti-1775360735545' && item.stem.includes('exam-assets/')))
    request.onerror = () => reject(request.error)
  })
  if (!question) throw new Error('没有找到带本地图像的真题')
  const now = new Date().toISOString()
  await new Promise((resolveWrite, reject) => {
    const transaction = db.transaction('practiceSessions', 'readwrite')
    transaction.objectStore('practiceSessions').put({
      id: 'proof-guizhou-image', mode: 'instant', status: 'active', title: '2026 贵州省考真题图文验证',
      questionIds: [question.id], selectedAnswers: {}, submittedQuestionIds: [], currentIndex: 0,
      elapsedSeconds: 0, startedAt: now, updatedAt: now,
    })
    transaction.oncomplete = () => resolveWrite(undefined)
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
  return question.id
})

await page.reload()
await page.getByRole('button', { name: /继续上次/ }).click()
await page.locator('.question-title img').waitFor()
await page.screenshot({ path: resolve(output, 'mobile-guizhou-question.png'), fullPage: true })
await writeFile(resolve(output, 'mobile-proof.json'), JSON.stringify({ capturedAt: new Date().toISOString(), questionId, screenshots: ['mobile-guizhou-filters.png', 'mobile-guizhou-question.png'] }, null, 2), 'utf8')
await browser.close()
console.log(JSON.stringify({ output, questionId }, null, 2))
