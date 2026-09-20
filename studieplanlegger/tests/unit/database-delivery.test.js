import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fingerprintLegacy, RevisionConflict, StateDatabase } from '../../server/database.js'
import { exportBackup, previewBackup } from '../../src/backup.js'

const directories = []
afterEach(() => { while (directories.length) rmSync(directories.pop(), { recursive: true, force: true }) })
function database() {
  const directory = mkdtempSync(join(tmpdir(), 'studieplan-sqlite-'))
  directories.push(directory)
  return { db: new StateDatabase(join(directory, 'state.sqlite')), filename: join(directory, 'state.sqlite') }
}
const task = (id, patch = {}) => ({ id, title: `Task ${id}`, course: 'TEST101', courseId: 'course', deadlineLocal: '2026-09-24T12:00', estimatedMinutes: 90, remainingMinutes: 45, completed: false, ...patch })
const state = () => ({
  schemaVersion: 1,
  __legacyExtension: { retained: true },
  tasks: [
    task('first'),
    task('second', { dependencyIds: ['first'], requiresSubmission: true, completed: true, submitted: false }),
    task('blocked', { dependencyIds: ['deleted-prerequisite'], missingDependencyIds: ['deleted-prerequisite'] }),
  ],
  sessions: [{ id: 'session', taskId: 'first', dateLocal: '2026-09-22', startTime: '10:00', endTime: '10:30' }],
  planner: {
    courses: [{ id: 'course', code: 'TEST101', name: 'Test course', university: 'Test', semester: 'autumn', year: 2026, notes: '', providerField: { retained: true } }],
    events: [{ id: 'event', title: 'Lecture', courseId: 'course', start: '2026-09-22T08:00:00Z', end: '2026-09-22T09:00:00Z', notes: '', providerExtra: 'exact' }],
    sources: [],
  },
  calendarPreferences: { version: 1, view: 'agenda', date: '2026-09-20', courseId: 'course', kinds: [], completed: true, cancelled: false, scroll: {} },
})

describe('SQLite state repository', () => {
  it('round-trips linked payloads losslessly and rejects stale writes atomically', () => {
    const { db } = database(), expected = state()
    const saved = db.save(expected, 0)
    expect(saved.revision).toBe(1)
    expect(db.read()).toEqual({ revision: 1, envelope: expected })
    expect(() => db.save(expected, 0)).toThrow(RevisionConflict)
    expect(db.read()).toEqual({ revision: 1, envelope: expected })
    expect(db.db.prepare('SELECT prerequisite_id FROM dependencies WHERE task_id=?').get('second').prerequisite_id).toBe('first')
    expect(db.db.prepare('SELECT missing_id FROM missing_dependencies WHERE task_id=?').get('blocked').missing_id).toBe('deleted-prerequisite')
    expect(db.db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    expect(() => db.db.prepare("INSERT INTO sessions(id,position,task_id,payload_json) VALUES('bad',99,'missing','{}')").run()).toThrow()
    expect(db.db.prepare('SELECT provider FROM courses WHERE id=?').get('course').provider).toBeNull()
    db.close()
  })

  it('migrates one exact browser envelope once, archives raw input and survives reopen', () => {
    const { db, filename } = database(), expected = state(), raw = JSON.stringify(expected)
    const preview = db.previewLegacy(raw)
    expect(preview).toMatchObject({ empty: true, counts: { tasks: 3, courses: 1, sessions: 1 } })
    const imported = db.importLegacy(raw, preview.fingerprint, 0)
    expect(imported.envelope).toEqual(expected)
    expect(db.importLegacy(raw, preview.fingerprint, 0)).toMatchObject({ repeated: true, envelope: expected })
    expect(db.previewLegacy(raw)).toMatchObject({ repeated: true, empty: false, counts: null })
    expect(db.db.prepare('SELECT raw FROM legacy_archives').get().raw).toBe(raw)
    db.close()
    const reopened = new StateDatabase(filename)
    expect(reopened.read()).toEqual({ revision: 1, envelope: expected })
    reopened.close()
  })

  it('makes recovery snapshots and work-history purge part of one transaction', () => {
    const { db } = database(), expected = state()
    const log = {
      id: 'work-operation', operationId: 'operation', taskId: 'first', at: '2026-09-20T08:00:00.000Z', outcome: 'more',
      actualMinutes: 30, plannedMinutes: 30, remainingMinutes: 45, interrupted: false, historyComplete: false,
      taskSnapshot: structuredClone(expected.tasks[0]),
    }
    expected.workLogs = [log]
    expected.history = { version: 1, undo: [{ id: 'history-work', label: 'Work', at: '2026-09-20T08:00:00.000Z', plannerExisted: true,
      changes: [{ path: 'workLogs', id: log.id, index: 0, before: null, after: structuredClone(log), existed: false }] }], trash: [] }
    const raw = JSON.stringify(expected), preview = db.previewLegacy(raw)
    db.importLegacy(raw, preview.fingerprint, 0)
    const secondArchive = { ...expected, workLogs: [{ ...log, id: 'second-work-operation', operationId: 'second-operation' }] }
    const secondRaw = JSON.stringify(secondArchive), secondFingerprint = fingerprintLegacy(secondRaw)
    db.db.prepare("INSERT INTO legacy_archives(fingerprint,imported_at,raw,revision) VALUES(?,datetime('now'),?,?)").run(secondFingerprint, secondRaw, 1)
    db.db.prepare("INSERT INTO legacy_archives(fingerprint,imported_at,raw,revision) VALUES('invalid',datetime('now'),'not-json',1)").run()
    const changed = { ...expected, tasks: expected.tasks.map(value => ({ ...value, remainingMinutes: 10 })) }
    db.save(changed, 1, { snapshot: true })
    expect(db.recovery().data).toEqual(expected)
    const purged = db.purge(2)
    expect(purged.envelope.workLogs).toBeUndefined()
    expect(purged.envelope.history).toEqual({ version: 1, undo: [], trash: [] })
    expect(db.recovery().data.workLogs).toBeUndefined()
    expect(db.recovery().data.history).toEqual({ version: 1, undo: [], trash: [] })
    for (const row of db.db.prepare('SELECT payload_json FROM recovery_snapshots').all()) expect(JSON.parse(row.payload_json).workLogs).toBeUndefined()
    const archives = db.db.prepare('SELECT fingerprint,raw FROM legacy_archives ORDER BY fingerprint').all()
    for (const row of archives.filter(row => row.fingerprint !== 'invalid')) {
      expect(JSON.parse(row.raw).workLogs).toBeUndefined()
      expect(JSON.parse(row.raw).history).toEqual({ version: 1, undo: [], trash: [] })
    }
    expect(archives.find(row => row.fingerprint === 'invalid').raw).toBe('not-json')
    db.close()
  })

  it('restores a portable backup into SQLite and refuses migration over saved settings', () => {
    const { db } = database(), expected = state()
    const current = { schemaVersion: 1, tasks: [], personalization: { enabled: true } }
    db.save(current, 0)
    const backup = exportBackup(expected, new Date('2026-09-20T09:00:00.000Z'))
    const preview = previewBackup(JSON.stringify(backup), current)
    expect(preview.ok).toBe(true)
    const restored = db.save(preview.data, 1, { snapshot: true })
    expect(restored.envelope).toEqual(expected)
    expect(db.recovery().data).toEqual(current)
    expect(db.read().envelope).toEqual(expected)
    db.close()

    const settingsOnly = database().db
    settingsOnly.save(current, 0)
    const raw = JSON.stringify(expected), migration = settingsOnly.previewLegacy(raw)
    expect(migration.empty).toBe(false)
    expect(() => settingsOnly.importLegacy(raw, migration.fingerprint, 1)).toThrow('database-not-empty')
    expect(settingsOnly.read().envelope).toEqual(current)
    settingsOnly.close()
  })

  it('applies explicit seed data only to an empty database', () => {
    const directory = mkdtempSync(join(tmpdir(), 'studieplan-seed-')); directories.push(directory)
    const filename = join(directory, 'state.sqlite'), expected = state()
    const seeded = new StateDatabase(filename, { seed: true, seedEnvelope: expected })
    expect(seeded.read().envelope).toEqual(expected)
    seeded.close()
    const reopened = new StateDatabase(filename, { seed: true, seedEnvelope: { schemaVersion: 1, tasks: [] } })
    expect(reopened.read().envelope).toEqual(expected)
    reopened.close()
  })

  it('upgrades the prior no-foreign-key schema without changing state or revision', () => {
    const { db, filename } = database(), expected = state()
    db.save(expected, 0)
    db.close()

    const old = new DatabaseSync(filename)
    old.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE tasks_old (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, course_id TEXT, completed INTEGER NOT NULL, payload_json TEXT NOT NULL);
      INSERT INTO tasks_old SELECT * FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_old RENAME TO tasks;
      DELETE FROM schema_migrations WHERE version >= 2;
    `)
    old.close()

    const upgraded = new StateDatabase(filename)
    expect(upgraded.read()).toEqual({ revision: 1, envelope: expected })
    expect(upgraded.db.prepare("PRAGMA foreign_key_list('tasks')").all().length).toBeGreaterThan(0)
    expect(upgraded.db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    expect(upgraded.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }])
    upgraded.close()
  })
})
