import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, renameSync, rmSync } from 'node:fs'
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

function createPreShapeDatabase(filename, { orphanCourse = false } = {}) {
  const envelope = state()
  const course = { ...envelope.planner.courses[0], sourceProvider: 'legacy-provider', sourceRecordId: 'legacy-course' }
  const preferences = {
    schemaVersion: 1,
    __legacyExtension: envelope.__legacyExtension,
    calendarPreferences: envelope.calendarPreferences,
    __hasSessions: true,
    __hasPlanner: true,
    __planner: {},
  }
  const legacy = new DatabaseSync(filename)
  legacy.exec(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE state_meta (singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL, preferences_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE courses (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, provider TEXT, source_record_id TEXT, payload_json TEXT NOT NULL);
    CREATE TABLE tasks (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, course_id TEXT, completed INTEGER NOT NULL, payload_json TEXT NOT NULL);
    CREATE TABLE sessions (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, task_id TEXT, date_local TEXT, payload_json TEXT NOT NULL);
    CREATE TABLE dependencies (task_id TEXT NOT NULL, prerequisite_id TEXT NOT NULL, position INTEGER NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(task_id, prerequisite_id));
    CREATE TABLE recovery_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, revision INTEGER NOT NULL, payload_json TEXT NOT NULL);
    CREATE TABLE legacy_archives (fingerprint TEXT PRIMARY KEY, imported_at TEXT NOT NULL, raw TEXT NOT NULL, revision INTEGER NOT NULL);
  `)
  legacy.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(1,?)').run('2026-09-01T08:00:00Z')
  legacy.prepare('INSERT INTO state_meta(singleton,revision,preferences_json,updated_at) VALUES(1,7,?,?)').run(JSON.stringify(preferences), '2026-09-01T08:00:00Z')
  if (!orphanCourse) legacy.prepare('INSERT INTO courses(id,position,provider,source_record_id,payload_json) VALUES(?,?,?,?,?)')
    .run('course', 0, 'legacy-provider', 'legacy-course', JSON.stringify(course))
  envelope.tasks.slice(0, 2).forEach((value, position) => legacy.prepare('INSERT INTO tasks(id,position,course_id,completed,payload_json) VALUES(?,?,?,?,?)')
    .run(value.id, position, orphanCourse ? 'missing-course' : value.courseId, value.completed ? 1 : 0, JSON.stringify(orphanCourse ? { ...value, courseId: 'missing-course' } : value)))
  legacy.prepare('INSERT INTO dependencies(task_id,prerequisite_id,position,payload_json) VALUES(?,?,?,?)').run('second', 'first', 0, JSON.stringify('first'))
  legacy.prepare('INSERT INTO sessions(id,position,task_id,date_local,payload_json) VALUES(?,?,?,?,?)')
    .run('session', 0, 'first', envelope.sessions[0].dateLocal, JSON.stringify(envelope.sessions[0]))
  legacy.prepare('INSERT INTO recovery_snapshots(created_at,revision,payload_json) VALUES(?,?,?)')
    .run('2026-09-01T07:00:00Z', 6, JSON.stringify({ schemaVersion: 1, tasks: [] }))
  legacy.prepare('INSERT INTO legacy_archives(fingerprint,imported_at,raw,revision) VALUES(?,?,?,?)')
    .run('legacy-fingerprint', '2026-09-01T08:00:00Z', JSON.stringify({ schemaVersion: 1, tasks: [] }), 7)
  legacy.close()
  return {
    revision: 7,
    envelope: {
      schemaVersion: 1,
      __legacyExtension: envelope.__legacyExtension,
      calendarPreferences: envelope.calendarPreferences,
      tasks: orphanCourse ? envelope.tasks.slice(0, 2).map(value => ({ ...value, courseId: 'missing-course' })) : envelope.tasks.slice(0, 2),
      sessions: envelope.sessions,
      planner: { courses: orphanCourse ? [] : [course], events: [], sources: [] },
    },
  }
}

describe('SQLite state repository', () => {
  it('upgrades a pre-shape database losslessly and remains idempotent across reopen', () => {
    const directory = mkdtempSync(join(tmpdir(), 'studieplan-pre-shape-')); directories.push(directory)
    const filename = join(directory, 'state.sqlite'), expected = createPreShapeDatabase(filename)
    const upgraded = new StateDatabase(filename)
    expect(upgraded.read()).toEqual(expected)
    expect(upgraded.db.prepare("PRAGMA table_info('state_meta')").all().some(column => column.name === 'shape_json')).toBe(true)
    expect(upgraded.db.prepare("PRAGMA foreign_key_list('tasks')").all().length).toBeGreaterThan(0)
    expect(upgraded.db.prepare('PRAGMA foreign_keys').get().foreign_keys).toBe(1)
    expect(upgraded.db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    expect(upgraded.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }])
    expect(upgraded.db.prepare('SELECT applied_at FROM schema_migrations WHERE version=1').get().applied_at).toBe('2026-09-01T08:00:00Z')
    expect(upgraded.db.prepare('SELECT revision,updated_at FROM state_meta').get()).toEqual({ revision: 7, updated_at: '2026-09-01T08:00:00Z' })
    expect(upgraded.db.prepare('SELECT provider,source_record_id FROM courses WHERE id=?').get('course')).toEqual({ provider: 'legacy-provider', source_record_id: 'legacy-course' })
    expect(upgraded.db.prepare('SELECT revision,payload_json FROM recovery_snapshots').get()).toEqual({ revision: 6, payload_json: JSON.stringify({ schemaVersion: 1, tasks: [] }) })
    expect(upgraded.db.prepare('SELECT fingerprint,imported_at,raw,revision FROM legacy_archives').get()).toEqual({ fingerprint: 'legacy-fingerprint', imported_at: '2026-09-01T08:00:00Z', raw: JSON.stringify({ schemaVersion: 1, tasks: [] }), revision: 7 })
    upgraded.close()

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const reopened = new StateDatabase(filename)
      expect(reopened.read()).toEqual(expected)
      expect(reopened.db.prepare('SELECT version FROM schema_migrations').all()).toHaveLength(3)
      reopened.close()
    }
  })

  it('rolls back every schema change when a legacy upgrade fails validation', () => {
    const directory = mkdtempSync(join(tmpdir(), 'studieplan-pre-shape-invalid-')); directories.push(directory)
    const filename = join(directory, 'state.sqlite')
    createPreShapeDatabase(filename, { orphanCourse: true })
    const before = new DatabaseSync(filename)
    const schemaBefore = before.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()
    before.close()

    expect(() => new StateDatabase(filename)).toThrow('Database migration failed foreign-key validation')

    const unchanged = new DatabaseSync(filename)
    expect(unchanged.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()).toEqual(schemaBefore)
    expect(unchanged.prepare("PRAGMA table_info('state_meta')").all().some(column => column.name === 'shape_json')).toBe(false)
    expect(unchanged.prepare("PRAGMA foreign_key_list('tasks')").all()).toEqual([])
    expect(unchanged.prepare('SELECT revision,preferences_json,updated_at FROM state_meta').get()).toMatchObject({ revision: 7, updated_at: '2026-09-01T08:00:00Z' })
    expect(unchanged.prepare('SELECT id,course_id FROM tasks ORDER BY position').all()).toEqual([
      { id: 'first', course_id: 'missing-course' },
      { id: 'second', course_id: 'missing-course' },
    ])
    expect(unchanged.prepare('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([{ version: 1 }])
    expect(unchanged.prepare('SELECT COUNT(*) count FROM recovery_snapshots').get().count).toBe(1)
    expect(unchanged.prepare('SELECT COUNT(*) count FROM legacy_archives').get().count).toBe(1)
    unchanged.close()
    const moved = `${filename}.moved`
    renameSync(filename, moved)
    renameSync(moved, filename)
  })

  it('adds shape metadata without rebuilding an already constrained schema', () => {
    const { db, filename } = database(), expected = state()
    db.save(expected, 0)
    db.close()

    const intermediate = new DatabaseSync(filename)
    intermediate.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN IMMEDIATE;
      CREATE TABLE state_meta_without_shape (singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL, preferences_json TEXT NOT NULL, updated_at TEXT NOT NULL);
      INSERT INTO state_meta_without_shape(singleton,revision,preferences_json,updated_at)
        SELECT singleton,revision,preferences_json,updated_at FROM state_meta;
      DROP TABLE state_meta;
      ALTER TABLE state_meta_without_shape RENAME TO state_meta;
      DELETE FROM schema_migrations WHERE version >= 3;
      COMMIT;
    `)
    intermediate.close()

    const upgraded = new StateDatabase(filename)
    expect(upgraded.read()).toEqual({ revision: 1, envelope: expected })
    expect(upgraded.db.prepare("PRAGMA table_info('state_meta')").all().some(column => column.name === 'shape_json')).toBe(true)
    expect(upgraded.db.prepare("PRAGMA foreign_key_list('tasks')").all().length).toBeGreaterThan(0)
    expect(upgraded.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }])
    upgraded.close()

    const reopened = new StateDatabase(filename)
    expect(reopened.read()).toEqual({ revision: 1, envelope: expected })
    reopened.close()
  })

  it('creates the complete current schema for a new empty database', () => {
    const { db } = database()
    expect(db.read()).toEqual({ revision: 0, envelope: { schemaVersion: 1, tasks: [] } })
    expect(db.db.prepare("PRAGMA table_info('state_meta')").all().some(column => column.name === 'shape_json')).toBe(true)
    expect(db.db.prepare("PRAGMA foreign_key_list('tasks')").all().length).toBeGreaterThan(0)
    expect(db.db.prepare('PRAGMA foreign_keys').get().foreign_keys).toBe(1)
    expect(db.db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    expect(db.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }])
    db.close()
  })

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
