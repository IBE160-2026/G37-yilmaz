const unavailable = /^(?:ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|EPIPE)$/

export function sourceTransportError(error) {
  if (unavailable.test(error?.code) || unavailable.test(error?.cause?.code) ||
      /\bgetaddrinfo\s+(?:ENOTFOUND|EAI_AGAIN)\b/.test(error?.message || '')) {
    return Object.assign(new Error('Fikk ikke kontakt med lærestedet. Prøv igjen senere. Lagrede data er beholdt.'), { status: 'transport-error' })
  }
  return error
}

export function safeSourceError(error) {
  error = sourceTransportError(error)
  // JSON/runtime errors can quote upstream content. Preserve deliberate domain
  // failures while keeping native errors safe in both responses and warnings.
  if (typeof error?.status !== 'string' && (!(error instanceof Error) ||
    [SyntaxError, TypeError, RangeError, ReferenceError, URIError, EvalError].some(type => error instanceof type))) {
    return Object.assign(new Error('Kilden returnerte et format som ikke kunne leses. Prøv filimport eller manuell registrering.'), { status: 'source-changed' })
  }
  return error
}
