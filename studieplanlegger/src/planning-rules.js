export const DEFAULT_PLANNING_RULES = Object.freeze({ sessionMinutes: 30, minimumMinutes: 15, maximumMinutes: 60, breakMinutes: 10 })
export function validPlanningRules(value) {
  return value && !Array.isArray(value) && ['sessionMinutes', 'minimumMinutes', 'maximumMinutes', 'breakMinutes'].every(key => Number.isSafeInteger(value[key]) && value[key] >= (key === 'breakMinutes' ? 0 : 1) && value[key] <= 1440) && value.minimumMinutes <= value.sessionMinutes && value.sessionMinutes <= value.maximumMinutes
}

// Capacity adds usable minutes; only the concrete replanner verifies a sequence
// of sessions with breaks and representable local endpoints.
export function capacityPlanningNote(rules) {
  const choices = validPlanningRules(rules) ? ` Valgte øktregler: ${rules.minimumMinutes}–${rules.maximumMinutes} min per økt, vanligvis ${rules.sessionMinutes} min, med ${rules.breakMinutes} min pause.` : ''
  return `Minuttsummen er en kapasitetsoversikt. Øktlengder, pauser og klokkeslett ved tidsskifte er ikke kontrollert som en gjennomførbar plan.${choices} Bruk Planlegg uken for å kontrollere et konkret forslag.`
}
export function validConnectedPreferences(state) {
  if (state.planningPreferences !== undefined && !validPlanningRules(state.planningPreferences)) return false
  if (state.personalization !== undefined && (!state.personalization || typeof state.personalization.enabled !== 'boolean')) return false
  if (state.onboarding !== undefined && (!state.onboarding || typeof state.onboarding.dismissed !== 'boolean' || state.onboarding.completed !== undefined && typeof state.onboarding.completed !== 'boolean')) return false
  return true
}
