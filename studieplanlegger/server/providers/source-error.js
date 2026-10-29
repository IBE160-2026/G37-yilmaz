export function safeSourceError(error) {
  // JSON/runtime errors can quote upstream content. Preserve deliberate domain
  // failures while keeping native errors safe in both responses and warnings.
  if (typeof error?.status !== 'string' && (!(error instanceof Error) ||
    [SyntaxError, TypeError, RangeError, ReferenceError, URIError, EvalError].some(type => error instanceof type))) {
    return Object.assign(new Error('Kilden returnerte et format som ikke kunne leses. Prøv filimport eller manuell registrering.'), { status: 'source-changed' })
  }
  return error
}
