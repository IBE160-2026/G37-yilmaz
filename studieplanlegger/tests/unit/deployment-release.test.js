import { describe, expect, it, vi } from 'vitest'
import { releaseMarker } from '../../vite.config.js'
import { verifyDeployedCommit } from '../../scripts/deployment-smoke.mjs'

const expected = 'a'.repeat(40), previous = 'b'.repeat(40)
const response = marker => new Response(JSON.stringify(marker), { headers: { 'content-type': 'application/json' } })

describe('deployed commit binding', () => {
  it('rejects the previous deployed build even when the local expected SHA is valid', async () => {
    const fetchImpl = vi.fn(async () => response({ commit: previous }))
    await expect(verifyDeployedCommit('https://ajour-synthetic.vercel.app', expected, fetchImpl)).rejects.toThrow('Deployed build does not match')
    expect(fetchImpl.mock.calls[0][0].pathname).toBe('/release.json')
  })
  it('accepts only the expected deployed marker and refuses redirects/cached responses', async () => {
    const fetchImpl = vi.fn(async () => response({ commit: expected }))
    await expect(verifyDeployedCommit('https://ajour-synthetic.vercel.app', expected, fetchImpl)).resolves.toBeUndefined()
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'error', cache: 'no-store' })
  })
  it('rejects missing or malformed markers without disclosing response content', async () => {
    const secret = 'SYNTHETIC_RELEASE_SECRET'
    for (const result of [response({ commit: null }), new Response(secret, { headers: { 'content-type': 'application/json' } }), new Response(secret, { status: 404 })]) {
      await expect(verifyDeployedCommit('https://ajour-synthetic.vercel.app', expected, async () => result)).rejects.not.toThrow(secret)
    }
  })
  it.each(['VERCEL_GIT_COMMIT_SHA', 'GITHUB_SHA', 'AJOUR_BUILD_SHA'])('emits only the commit from %s, never environment metadata', variable => {
    const emitted = []
    releaseMarker({ [variable]: expected, SECRET: 'SYNTHETIC_RELEASE_SECRET' }).generateBundle.call({ emitFile: asset => emitted.push(asset) })
    expect(emitted).toEqual([{ type: 'asset', fileName: 'release.json', source: JSON.stringify({ commit: expected }) }])
  })
  it('prefers the Vercel commit and refuses invalid commit metadata', () => {
    const emitFile = vi.fn()
    releaseMarker({ VERCEL_GIT_COMMIT_SHA: expected, GITHUB_SHA: previous }).generateBundle.call({ emitFile })
    expect(JSON.parse(emitFile.mock.calls[0][0].source)).toEqual({ commit: expected })
    expect(() => releaseMarker({ AJOUR_BUILD_SHA: 'SYNTHETIC_RELEASE_SECRET' })).toThrow('Build commit must be a full Git SHA.')
  })
})
