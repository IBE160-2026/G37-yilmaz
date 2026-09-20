// Server-only. No token, schema, or authenticated response goes into app storage.
export const SIKT_READ_SCOPE = 'sikt:utdanningsregisteret/utdanning.read'
export const SIKT_ENDPOINTS = Object.freeze({ production: 'https://api.fsweb.no/graphql', test: 'https://api-test.fsweb.no/graphql' })
// Standard GraphQL introspection only, not guessed education-domain fields.
export const SCHEMA_PROBE = `query StudieplanReadOnlySchema {
  __schema {
    queryType { name fields { name args { name type { kind name ofType { kind name } } } type { kind name ofType { kind name } } } }
    types { kind name fields { name type { kind name ofType { kind name } } } }
  }
}`
export function createSiktAdapter({ env = process.env, fetchImpl = globalThis.fetch, getAccessToken = () => env.SIKT_ACCESS_TOKEN } = {}) {
  const environment = env.SIKT_ENVIRONMENT || 'production'
  const endpoint = SIKT_ENDPOINTS[environment]
  function status() {
    if (!endpoint) return { status: 'configuration-error', error: 'SIKT_ENVIRONMENT must be production or test.' }
    if (env.SIKT_ENABLED !== 'true') return { status: 'access-required', error: 'Sikt is disabled. Approved Maskinporten read access and an authenticated schema check are required. See SIKT-ACCESS.md.', scope: SIKT_READ_SCOPE }
    return { status: 'schema-verification-required', error: 'The read-only transport is prepared. Education search is not enabled until the authenticated schema and response mapping have been verified.', scope: SIKT_READ_SCOPE }
  }
  async function probeSchema() {
    const current = status()
    if (current.status !== 'schema-verification-required') return current
    const token = await getAccessToken()
    if (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token)) return { status: 'access-required', error: 'A valid short-lived server-side Maskinporten token is required.' }
    try {
      const response = await fetchImpl(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}`, 'Feature-Flags': 'beta,experimental', 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query: SCHEMA_PROBE, operationName: 'StudieplanReadOnlySchema' }) })
      if ([401, 403].includes(response.status)) return { status: 'access-required', httpStatus: response.status, error: 'Sikt rejected the configured read access. Check token expiry, environment and granted scope.' }
      if (!response.ok) return { status: 'transport-error', httpStatus: response.status, error: 'Sikt schema request failed.' }
      const chunks = []; let size = 0
      for await (const chunk of response.body) { size += chunk.byteLength; if (size > 2_000_000) throw new Error('response-limit'); chunks.push(chunk) }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (data.errors?.length || !data.data?.__schema?.queryType) return { status: 'schema-verification-required', error: 'Introspection was rejected or returned an unexpected schema. Request the official schema from Sikt. No domain fields have been assumed.' }
      return { status: 'ok', endpoint, scope: SIKT_READ_SCOPE, schema: data.data.__schema, warning: 'Schema transport only. Search, semester/campus semantics and domain mapping still require authenticated verification.' }
    } catch { return { status: 'transport-error', error: 'Could not read the Sikt schema safely. No credentials or response body are included in this error.' } }
  }
  return { status, search: async () => status(), details: async () => status(), probeSchema }
}
