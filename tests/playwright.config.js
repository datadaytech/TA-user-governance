// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './',
  testMatch: '**/*.spec.js',  // Only match .spec.js files (Jest uses .test.js)
  testIgnore: ['**/unit/**', '**/node_modules/**'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: process.env.SPLUNK_URL || 'http://localhost:8000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Global timeout for each test
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },
});
