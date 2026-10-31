import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e/crm-r2',
  timeout: 20_000,
  expect: {timeout: 8_000},
  retries: 0,
  workers: 1,
  use: { baseURL:'http://127.0.0.1:4176', browserName:'chromium', headless:true },
  webServer: {
    command:'npx vite --config vite.r2.acceptance.config.ts',
    url:'http://127.0.0.1:4176/r2-acceptance/',
    reuseExistingServer:false,
    timeout: 60_000
  },
  reporter:[['list']],
});
