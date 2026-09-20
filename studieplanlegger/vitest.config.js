import { defineConfig } from 'vitest/config'

process.env.TZ = 'Europe/Oslo'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
})
