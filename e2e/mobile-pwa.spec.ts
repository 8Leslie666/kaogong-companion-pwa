import { expect, test } from '@playwright/test'

test('mobile learner can answer a question and resume after reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /第一题开始|继续向前/ })).toBeVisible()
  await page.getByRole('button', { name: '刷题' }).click()
  await expect(page.getByRole('heading', { name: '把每一组题，都练出反馈' })).toBeVisible()
  await page.locator('.count-picker button').first().click()
  await page.getByRole('button', { name: '开始逐题练习' }).click()
  await expect(page.locator('.question-title')).toBeVisible()
  await page.locator('.answers button').first().click()
  await page.getByRole('button', { name: '提交答案' }).click()
  await expect(page.getByRole('heading', { name: '解析' })).toBeVisible()
  await page.getByRole('button', { name: '退出练习' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: /继续上次/ })).toBeVisible()
})

test('installed app shell starts offline after first load', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByText('考公陪跑宝典')).toBeVisible()
  await page.waitForFunction(async () => Boolean(await navigator.serviceWorker?.ready))
  await context.setOffline(true)
  await page.reload()
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
  await expect(page.getByRole('button', { name: '刷题' })).toBeVisible()
})

test('large bank filters update the available count before starting', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '刷题' }).click()
  await expect(page.getByText('2657 道可用')).toBeVisible()
  await page.getByRole('button', { name: 'C-Eval 公务员公开题' }).click()
  await expect(page.getByText('52 道可用')).toBeVisible()
  await page.getByRole('button', { name: '1 星' }).click()
  await expect(page.getByText('0 道可用')).toBeVisible()
  await expect(page.getByRole('button', { name: '当前筛选暂无题目' })).toBeDisabled()
})

test('historical paper catalog and province filters work on mobile', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '刷题' }).click()
  await page.getByText('722 套国考与省考目录').click()
  await page.getByLabel('搜索年份或标题').fill('2025年浙江')
  await expect(page.locator('.catalog-list a').first()).toContainText('浙江')

  const filters = page.locator('.filter-panel')
  await filters.getByRole('button', { name: '2025', exact: true }).click()
  await filters.getByRole('button', { name: '浙江', exact: true }).click()
  await filters.getByRole('button', { name: 'A类', exact: true }).click()
  await expect(page.getByText('125 道可用')).toBeVisible()
})
