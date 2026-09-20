import { createSiktAdapter } from './providers/sikt.js'
// Explicit operator command, never run automatically on app startup.
const result = await createSiktAdapter().probeSchema()
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (result.status !== 'ok') process.exitCode = 1
