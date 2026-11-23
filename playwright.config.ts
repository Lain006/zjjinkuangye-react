import { randomUUID } from 'node:crypto'
import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3101'
process.env.PW_TEST_ADMIN_PASSWORD ??= randomUUID()

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 35000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, screenshot: 'only-on-failure' },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  }],
  webServer: {
    command: 'npm start',
    url: baseURL + '/api/v1/health',
    timeout: 30000,
    reuseExistingServer: false,
    env: {
      PORT: '3101',
      PUBLIC_ORIGIN: baseURL,
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://zj_course@127.0.0.1:55432/zj_course',
      ADMIN_PASSWORD: process.env.PW_TEST_ADMIN_PASSWORD,
    },
  },
})
