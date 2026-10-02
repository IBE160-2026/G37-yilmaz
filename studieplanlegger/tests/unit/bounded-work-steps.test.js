import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { taskSteps, migrateLegacyStep, saveWorkSteps, completeWorkStep, reorderWorkSteps, removeWorkStep, validWorkSteps, legacyStepId } from '../../src/work-steps.js'
import { setNextStep, clearNextStep, completeNextStep, validTasks, getActionMinutes } from '../../src/tasks.js'
import { createStorage, STORAGE_KEY, validEnvelope } from '../../src/storage.js'
import { recordChange, undoLast } from '../../src/history.js'
import { exportBackup, previewBackup } from '../../src/backup.js'
import { StateDatabase } from '../../server/database.js'
import { createWorkStepProposal, approveWorkStepProposal } from '../../src/work-step-proposals.js'
import { closeWork } from '../../src/work-log.js'

// All values are synthetic. IDs deliberately collide with legacy derivation.
const base = { id: 'synthetic-mixed', title: 'Syntetisk blandet oppgave', course: '', deadlineLocal: '', estimatedMinutes: 80, remainingMinutes: 60, completed: false }
const mixed = () => ({ ...base, nextStep: { description: 'Behold eldre tekst', estimatedMinutes: 15, unblocksWaiting: true }, steps: [
  { id: `${base.id}:legacy-next-step`, title: 'Eksisterende første', completed: false, notes: 'Behold notat', provenance: { kind: 'manual' } },
  { id: 'dependent', title: 'Avhengig steg', completed: false, dependencyIds: [`${base.id}:legacy-next-step`] },
  { id: `${base.id}:legacy-next-step:2`, title: 'Fullført annet', completed: true, estimatedMinutes: 20 },
] })

describe('bounded mixed work-step preservation', () => {
  it.each([
    { titleLength: 2000, idLength: 1983, collision: false },
    { titleLength: 2001, idLength: 20, collision: false },
    { titleLength: 20, idLength: 1984, collision: false },
    { titleLength: 2001, idLength: 1984, collision: false },
    { titleLength: 6000, idLength: 2001, collision: false },
    { titleLength: 2001, idLength: 1983, collision: true },
  ])('preserves legacy boundaries $titleLength/$idLength (collision $collision) through completion, closeout, storage and backup', ({ titleLength, idLength, collision }) => {
    const task = { ...base, id: 't'.repeat(idLength), nextStep: { description: 'x'.repeat(titleLength), estimatedMinutes: 15 } }
    const expectedId = `${legacyStepId(task.id)}${collision ? ':2' : ''}`
    const directory = mkdtempSync(join(tmpdir(), 'studieplan-legacy-boundary-')), filename = join(directory, 'synthetic.sqlite')
    let database
    try {
      database = new StateDatabase(filename)
      for (const mixedState of [false, true]) {
        const source = { ...task, ...(mixedState ? { steps: [{ id: collision ? legacyStepId(task.id) : 'existing', title: 'Behold fullført steg', completed: true, notes: 'Behold notat' }] } : {}) }
        const initial = { schemaVersion: 1, tasks: [source] }
        expect(validEnvelope(initial, { relations: true })).toBe(true)
        const normalized = migrateLegacyStep(source), stepId = mixedState ? expectedId : legacyStepId(task.id)
        expect(normalized.steps.at(-1)).toMatchObject({ id: stepId, title: task.nextStep.description, completed: false })
        expect(saveWorkSteps(source, source.steps || [])).toEqual({ ok: true, task: normalized })
        expect(migrateLegacyStep(normalized)).toEqual(normalized)
        const completed = completeNextStep([source], source.id)
        expect(completed.ok).toBe(true)
        expect(completed.tasks[0].steps.at(-1)).toMatchObject({ id: stepId, title: task.nextStep.description, completed: true })
        const closed = closeWork(initial, { taskId: source.id, operationId: `boundary-${mixedState}`, actualMinutes: 15, outcome: 'done' }, { now: new Date('2026-10-02T10:00:00Z') })
        expect(closed.ok).toBe(true)
        expect(closed.log.taskSnapshot).toEqual(source)
        const withDependency = { ...normalized, steps: [...normalized.steps, { id: 'dependent', title: 'Avhengig', completed: false, dependencyIds: [stepId] }] }
        for (const candidate of [
          { ...initial, tasks: [normalized] }, { ...initial, tasks: completed.tasks }, closed.state, { ...initial, tasks: [withDependency] },
        ]) {
          expect(validEnvelope(candidate, { relations: true })).toBe(true)
          expect(candidate.tasks[0].steps.find(step => step.id === stepId).title).toBe(task.nextStep.description)
          const values = new Map([[STORAGE_KEY, JSON.stringify(initial)]])
          const browser = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
          const storage = createStorage(() => browser)
          expect(storage.read().ok).toBe(true)
          expect(storage.writeEnvelope(candidate).ok).toBe(true)
          const reloaded = createStorage(() => browser)
          expect(reloaded.read().ok).toBe(true); expect(reloaded.snapshot()).toEqual(candidate)
          const backup = previewBackup(JSON.stringify(exportBackup(candidate)), initial)
          expect(backup.ok).toBe(true)
          expect(reloaded.replace(initial).ok).toBe(true)
          expect(reloaded.replace(backup.data).ok).toBe(true)
          expect(reloaded.snapshot()).toEqual(backup.data)
          expect(reloaded.recovery().data).toEqual(initial)
          database.save(initial, database.revision())
          database.save(candidate, database.revision()); database.close()
          database = new StateDatabase(filename)
          expect(database.read().envelope).toEqual(candidate)
          database.save(initial, database.revision())
          database.save(backup.data, database.revision(), { snapshot: true }); database.close()
          database = new StateDatabase(filename)
          expect(database.read().envelope).toEqual(backup.data)
          expect(database.recovery().data).toEqual(initial)
        }
      }
    } finally { database?.close(); rmSync(directory, { recursive: true, force: true }) }
  })

  it('keeps ordinary text and identity limits while allowing only preserved legacy content and references', () => {
    const step = { id: 'ordinary', title: 'Steg', completed: false, provenance: { kind: 'manual' } }
    expect(validWorkSteps([{ ...step, title: 'x'.repeat(2000), id: 's'.repeat(2000) }])).toBe(true)
    for (const patch of [
      { title: 'x'.repeat(2001) }, { id: 's'.repeat(2001) },
      { id: legacyStepId('s'.repeat(2001)) }, { notes: 'x'.repeat(2001) },
      { provenance: { kind: 'legacy-next-step', sourceId: 'x'.repeat(2001) } },
      { provenance: { kind: 'legacy-next-step', sourceExcerpt: 'x'.repeat(2001) } },
      { dependencyIds: ['s'.repeat(2001)] },
    ]) expect(validWorkSteps([{ ...step, ...patch }])).toBe(false)
    expect(validWorkSteps([{ ...step, id: 's'.repeat(2001), provenance: { kind: 'legacy-next-step' } }])).toBe(false)
  })

  it('reads mixed content without mutation, appends collision-safe legacy identity and migrates idempotently', () => {
    const task = mixed(), before = structuredClone(task), steps = taskSteps(task)
    expect(steps.slice(0, 3)).toEqual(task.steps)
    expect(steps[3]).toEqual({ id: `${base.id}:legacy-next-step:3`, title: 'Behold eldre tekst', estimatedMinutes: 15, completed: false, unblocksWaiting: true, provenance: { kind: 'legacy-next-step' } })
    expect(task).toEqual(before)
    const normalized = migrateLegacyStep(task)
    expect(normalized.steps).toEqual(steps); expect(normalized).not.toHaveProperty('nextStep')
    expect(migrateLegacyStep(normalized)).toEqual(normalized)
    expect(saveWorkSteps(task, task.steps).task).toEqual(normalized)
    expect(saveWorkSteps(normalized, normalized.steps).task).toEqual(normalized)
  })

  it('deduplicates only explicit legacy origin and exact source content, retaining completion and later context', () => {
    const task = { ...base, nextStep: { description: 'Samme tekst', estimatedMinutes: 15 } }
    const exact = { id: 'already-migrated', title: 'Samme tekst', estimatedMinutes: 15, completed: false, provenance: { kind: 'legacy-next-step' } }
    expect(taskSteps({ ...task, steps: [exact] })).toEqual([exact])
    for (const patch of [{ completed: true }, { notes: 'Eget innhold' }]) {
      const enriched = { ...exact, ...patch }
      expect(taskSteps({ ...task, steps: [enriched] })).toEqual([enriched])
    }
    expect(getActionMinutes({ ...task, steps: [{ ...exact, completed: true }] })).toBe(60)
    for (const patch of [{ provenance: { kind: 'manual' } }, { estimatedMinutes: 16 }, { title: 'Samme tekst!' }, { unblocksWaiting: true }]) {
      const distinct = { ...exact, ...patch }
      expect(taskSteps({ ...task, steps: [distinct] })).toEqual([distinct, expect.objectContaining({ title: 'Samme tekst', completed: false })])
    }
  })

  it('preserves all identities, text, order and dependencies through legacy edits, completion, reorder and proposal approval', () => {
    const task = mixed(), source = structuredClone(task), legacy = taskSteps(task)[3]
    const edited = setNextStep([task], task.id, { description: 'Redigert første', estimatedMinutes: '12' }).tasks[0]
    expect(edited.steps.map(step => step.id)).toEqual(taskSteps(task).map(step => step.id))
    expect(edited.steps[0]).toMatchObject({ notes: 'Behold notat', title: 'Redigert første' })
    expect(edited.steps.slice(1)).toEqual(taskSteps(task).slice(1))
    const completed = completeNextStep([task], task.id).tasks[0]
    expect(completed.steps[0].completed).toBe(true)
    expect(completed.steps.slice(1)).toEqual(taskSteps(task).slice(1))
    const legacyDone = completeWorkStep(task, legacy.id).task
    expect(legacyDone.steps[3]).toEqual({ ...legacy, completed: true })
    const reordered = reorderWorkSteps(task, taskSteps(task).map(step => step.id).reverse()).task
    expect(reordered.steps).toEqual(taskSteps(task).slice().reverse())
    const proposal = createWorkStepProposal({ sourceId: 'synthetic-doc', taskId: task.id, rows: [{ key: '1', title: 'Nytt krav', kind: 'requirement' }] })
    const approved = approveWorkStepProposal(task, proposal).task
    expect(approved.steps.slice(0, 4)).toEqual(taskSteps(task)); expect(approved).not.toHaveProperty('nextStep')
    expect(approveWorkStepProposal(approved, proposal).task).toEqual(approved)
    expect(task).toEqual(source)
    expect(validTasks([edited, { ...legacyDone, id: 'second-task' }, { ...reordered, id: 'third-task' }])).toBe(true)
  })

  it('blocks both removal actions without touching dependencies and allows explicit prerequisite editing', () => {
    const task = mixed(), source = structuredClone(task)
    for (const result of [clearNextStep([task], task.id), removeWorkStep(task, task.steps[0].id)]) {
      expect(result).toMatchObject({ ok: false, reason: 'dependent-steps', dependentIds: ['dependent'] })
      expect(result.error).toContain('Avhengig steg'); expect(result.error).toContain('Rediger forutsetningene')
    }
    expect(task).toEqual(source)
    const corrected = migrateLegacyStep(task); delete corrected.steps[1].dependencyIds
    const removed = removeWorkStep(corrected, task.steps[0].id)
    expect(removed.ok).toBe(true); expect(removed.task.steps).toEqual(corrected.steps.slice(1))
  })

  it('retains mixed content and original snapshots through whole-task, step-only and ordinary work closeout', () => {
    const initial = { schemaVersion: 1, tasks: [mixed()] }, originalSteps = taskSteps(initial.tasks[0])
    for (const draft of [{ outcome: 'done' }, { outcome: 'done', stepOnly: true }, { outcome: 'more', remainingMinutes: 30 }]) {
      const result = closeWork(initial, { taskId: base.id, operationId: 'synthetic-closeout', actualMinutes: 15, ...draft }, { now: new Date('2026-10-02T10:00:00Z') })
      expect(result.ok).toBe(true)
      expect(result.state.tasks[0].steps.map(step => step.id)).toEqual(originalSteps.map(step => step.id))
      expect(result.state.tasks[0].steps.map(({ completed, ...step }) => step)).toEqual(originalSteps.map(({ completed, ...step }) => step))
      expect(result.log.taskSnapshot).toEqual(initial.tasks[0])
      if (draft.outcome === 'done' && !draft.stepOnly) expect(result.state.tasks[0].steps.every(step => step.completed)).toBe(true)
      else expect(result.state.tasks[0].steps.at(-1).completed).toBe(false)
      expect(validEnvelope(result.state, { relations: true })).toBe(true)
    }
  })

  it('round-trips mixed and normalized state through local storage, atomic undo, backup, SQLite reopen and recovery', () => {
    const initial = { schemaVersion: 1, tasks: [mixed()], onboarding: { dismissed: true, completed: true } }
    const values = new Map([[STORAGE_KEY, JSON.stringify(initial)]]), browser = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
    const storage = createStorage(() => browser)
    expect(storage.read().ok).toBe(true); expect(storage.snapshot()).toEqual(initial)
    expect(values.get(STORAGE_KEY)).toBe(JSON.stringify(initial))
    const after = { ...initial, tasks: [completeWorkStep(initial.tasks[0], initial.tasks[0].steps[0].id).task] }
    const recorded = recordChange(initial, after)
    const committed = { ...after, history: recorded }
    expect(validEnvelope(committed, { relations: true })).toBe(true)
    expect(storage.writeEnvelope(committed).ok).toBe(true)
    const undone = undoLast(after, recorded)
    expect(undone.ok).toBe(true); expect(undone.state.tasks).toEqual(initial.tasks)
    const backup = previewBackup(JSON.stringify(exportBackup(committed)), { schemaVersion: 1, tasks: [] })
    expect(backup.ok).toBe(true); expect(backup.data.tasks).toEqual(after.tasks)
    const directory = mkdtempSync(join(tmpdir(), 'studieplan-bounded-steps-')), filename = join(directory, 'synthetic.sqlite')
    let database
    try {
      database = new StateDatabase(filename)
      database.save(initial, 0); database.close()
      database = new StateDatabase(filename); expect(database.read().envelope).toEqual(initial)
      database.save(committed, 1, { snapshot: true }); database.close()
      database = new StateDatabase(filename); expect(database.read()).toEqual({ revision: 2, envelope: committed })
      expect(database.recovery().data).toEqual(initial)
      database.save(backup.data, 2, { snapshot: true })
      expect(database.read().envelope).toEqual(backup.data)
      expect(database.recovery().data).toEqual(committed)
      expect(database.db.prepare('PRAGMA integrity_check').get().integrity_check).toBe('ok')
      expect(database.db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally { database?.close(); rmSync(directory, { recursive: true, force: true }) }
  })
})
