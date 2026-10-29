import { importMiddleware } from './import-api.js'
import { hostedImportPolicy } from './hosted-import-policy.js'

function jsonError(res, status, error) {
  if (res.writableEnded || res.destroyed) return
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify({ error }))
}

// This handler imports no database or state/backup endpoints. All provider
// results are previews; browser storage owns the user's saved plan.
export function createHostedImportHandler(dependencies = {}) {
  return async (req, res) => {
    try {
      await importMiddleware(req, res, () => jsonError(res, 404, 'API-endepunktet finnes ikke.'), { ...dependencies, hostedPolicy: { ...hostedImportPolicy, ...dependencies.hostedPolicy } })
    } catch {
      // Runtime/parser errors must not echo request bodies or source secrets.
      jsonError(res, 400, 'Ugyldig importforespørsel. Bruk filimport eller manuell registrering.')
    }
  }
}

export default createHostedImportHandler()
