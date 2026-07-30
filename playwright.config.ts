import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const localChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    ...devices['Pixel 5'],
    launchOptions: existsSync(localChrome) ? { executablePath: localChrome } : undefined,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
