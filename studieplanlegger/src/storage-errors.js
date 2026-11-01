export function storageFailure(error, fallback = 'unwritable', stage) {
  const reason = error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    ? 'quota' : error?.name === 'SecurityError' ? 'storage-denied' : fallback
  return { ok: false, reason, ...(reason !== fallback && stage ? { stage } : {}) }
}

export function storageErrorMessage(result, { restore = false } = {}) {
  const prefix = restore ? 'Erstatningen ble stoppet.' : 'Kunne ikke lagre.'
  const preserved = restore ? 'Tidligere data er beholdt.' : 'Tidligere data og utkast er beholdt.'
  if (result.reason === 'conflict') return 'En annen fane har endret dataene. Last inn på nytt før du lagrer.'
  if (result.reason === 'quota') return `${prefix} Nettleseren avviste skrivingen ved lagringsgrensen${result.stage === 'recovery' ? ' da gjenopprettingskopien skulle lagres' : ''}. ${preserved} Eksporter en sikkerhetskopi før du vurderer andre lagringsvalg.`
  if (result.reason === 'storage-denied') return `${prefix} Nettleseren tillater ikke lokal lagring her. ${preserved} Kontroller nettleserens tillatelser for nettstedet.`
  if (result.reason === 'invalid') return `${prefix} Dataene har en ugyldig verdi eller kobling. ${preserved}`
  if (result.reason === 'recovery-failed') return `${prefix} Gjenopprettingskopien kunne ikke lagres eller kontrolleres. ${preserved} Prøv igjen; feilen bekrefter ikke at lagringsplassen er full.`
  return `${prefix} ${preserved} Lagringen kunne ikke fullføres; årsaken er ikke fastslått.`
}
