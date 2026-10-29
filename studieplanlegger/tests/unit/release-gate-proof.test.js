import { expect, it } from 'vitest'

// Deliberately failing synthetic proof, isolated on test/ajour-release-gate.
// This branch must never be merged. Vercel's build subset remains valid so the
// external full-quality check, rather than a broken application, is exercised.
it('controlled release gate proof must prevent publication', () => {
  expect('blocked').toBe('publish')
})
