import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { validEnvelope } from '../src/storage.js'
import { purgeWorkHistory } from '../src/work-log.js'

const EMPTY = { schemaVersion: 1, tasks: [] }
const json = value => JSON.stringify(value)
const parse = value => JSON.parse(value)

export class RevisionConflict extends Error {
  constructor(revision) { super('stale-revision'); this.name = 'RevisionConflict'; this.revision = revision }
}

export function fingerprintLegacy(raw) {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

export class StateDatabase {
  constructor(filename, { seedFile, seedEnvelope, seed = false } = {}) {
    mkdirSync(dirname(filename), { recursive: true })
    this.db = new DatabaseSync(filename)
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000')
    this.migrate()
    if (seed && this.isEmpty()) {
      if (seedEnvelope) this.seedEnvelope(seedEnvelope)
      else if (seedFile) this.seed(seedFile)
      else throw new Error('STUDIEPLAN_SEED is true, but no explicit seed was provided.')
    }
  }

  migrate() {
    this.db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS state_meta (singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL, preferences_json TEXT NOT NULL, shape_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, provider TEXT, source_record_id TEXT, payload_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, course_id TEXT REFERENCES courses(id) ON DELETE RESTRICT, completed INTEGER NOT NULL, payload_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS tasks_course_id ON tasks(course_id);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, task_id TEXT REFERENCES tasks(id) ON DELETE RESTRICT, date_local TEXT, payload_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_task_id ON sessions(task_id);
      CREATE TABLE IF NOT EXISTS dependencies (task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, prerequisite_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT, position INTEGER NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(task_id, prerequisite_id));
      CREATE TABLE IF NOT EXISTS missing_dependencies (task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, missing_id TEXT NOT NULL, position INTEGER NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(task_id, missing_id));
      CREATE TABLE IF NOT EXISTS work_logs (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, task_id TEXT, operation_id TEXT UNIQUE, outcome TEXT, payload_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS work_logs_task_id ON work_logs(task_id);
      CREATE TABLE IF NOT EXISTS planner_events (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, course_id TEXT REFERENCES courses(id) ON DELETE RESTRICT, source_id TEXT REFERENCES planner_sources(id) ON DELETE RESTRICT, start_at TEXT, payload_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS planner_events_course_id ON planner_events(course_id);
      CREATE TABLE IF NOT EXISTS planner_sources (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT, kind TEXT, payload_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS import_sources (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, kind TEXT, content_hash TEXT, payload_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS import_entries (source_id TEXT NOT NULL REFERENCES import_sources(id) ON DELETE CASCADE, entry_key TEXT NOT NULL, position INTEGER NOT NULL, target_id TEXT, kind TEXT, payload_json TEXT NOT NULL, PRIMARY KEY(source_id, entry_key));
      CREATE TABLE IF NOT EXISTS windows (kind TEXT NOT NULL CHECK(kind IN ('work','busy')), id TEXT NOT NULL, position INTEGER NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS history_state (singleton INTEGER PRIMARY KEY CHECK(singleton=1), payload_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS recovery_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, revision INTEGER NOT NULL, payload_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS legacy_archives (fingerprint TEXT PRIMARY KEY, imported_at TEXT NOT NULL, raw TEXT NOT NULL, revision INTEGER NOT NULL);
      INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (1, datetime('now'));
      INSERT OR IGNORE INTO state_meta(singleton, revision, preferences_json, shape_json, updated_at) VALUES (1, 0, '{"schemaVersion":1}', '{}', datetime('now'));
      COMMIT;
    `)
    if (!this.db.prepare("PRAGMA table_info('state_meta')").all().some(column => column.name === 'shape_json')) {
      this.db.exec("ALTER TABLE state_meta ADD COLUMN shape_json TEXT NOT NULL DEFAULT '{}'")
    }
    if (this.db.prepare("PRAGMA foreign_key_list('tasks')").all().length === 0) this._upgradeForeignKeys()
    else this.db.prepare("INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(2,datetime('now'))").run()
    this.db.prepare("INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(3,datetime('now'))").run()
  }

  _upgradeForeignKeys() {
    const current = this.read()
    this.db.exec('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE')
    try {
      for (const table of ['dependencies','missing_dependencies','sessions','work_logs','planner_events','planner_sources','import_entries','import_sources','tasks','courses','windows','history_state']) this.db.exec(`DROP TABLE IF EXISTS ${table}`)
      this.db.exec(`
        CREATE TABLE courses (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, provider TEXT, source_record_id TEXT, payload_json TEXT NOT NULL);
        CREATE TABLE tasks (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, course_id TEXT REFERENCES courses(id) ON DELETE RESTRICT, completed INTEGER NOT NULL, payload_json TEXT NOT NULL);
        CREATE INDEX tasks_course_id ON tasks(course_id);
        CREATE TABLE sessions (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, task_id TEXT REFERENCES tasks(id) ON DELETE RESTRICT, date_local TEXT, payload_json TEXT NOT NULL);
        CREATE INDEX sessions_task_id ON sessions(task_id);
        CREATE TABLE dependencies (task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, prerequisite_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT, position INTEGER NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(task_id, prerequisite_id));
        CREATE TABLE missing_dependencies (task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, missing_id TEXT NOT NULL, position INTEGER NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(task_id, missing_id));
        CREATE TABLE work_logs (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, task_id TEXT, operation_id TEXT UNIQUE, outcome TEXT, payload_json TEXT NOT NULL);
        CREATE INDEX work_logs_task_id ON work_logs(task_id);
        CREATE TABLE planner_sources (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT, kind TEXT, payload_json TEXT NOT NULL);
        CREATE TABLE planner_events (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, course_id TEXT REFERENCES courses(id) ON DELETE RESTRICT, source_id TEXT REFERENCES planner_sources(id) ON DELETE RESTRICT, start_at TEXT, payload_json TEXT NOT NULL);
        CREATE INDEX planner_events_course_id ON planner_events(course_id);
        CREATE TABLE import_sources (id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, kind TEXT, content_hash TEXT, payload_json TEXT NOT NULL);
        CREATE TABLE import_entries (source_id TEXT NOT NULL REFERENCES import_sources(id) ON DELETE CASCADE, entry_key TEXT NOT NULL, position INTEGER NOT NULL, target_id TEXT, kind TEXT, payload_json TEXT NOT NULL, PRIMARY KEY(source_id, entry_key));
        CREATE TABLE windows (kind TEXT NOT NULL CHECK(kind IN ('work','busy')), id TEXT NOT NULL, position INTEGER NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(kind,id));
        CREATE TABLE history_state (singleton INTEGER PRIMARY KEY CHECK(singleton=1), payload_json TEXT NOT NULL);
      `)
      this._replace(current.envelope, current.revision)
      this.db.prepare("INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(2,datetime('now'))").run()
      this.db.exec('COMMIT')
    } catch (error) { this.db.exec('ROLLBACK'); throw error }
    finally { this.db.exec('PRAGMA foreign_keys = ON') }
  }

  close() { this.db.close() }
  revision() { return this.db.prepare('SELECT revision FROM state_meta WHERE singleton=1').get().revision }
  isEmpty() {
    return this.revision() === 0 && ['tasks', 'courses', 'sessions', 'work_logs', 'planner_events', 'planner_sources', 'import_sources']
      .every(table => this.db.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count === 0)
  }

  seed(seedFile) {
    this.seedEnvelope(parse(readFileSync(seedFile, 'utf8')))
  }

  seedEnvelope(value) {
    if (!validEnvelope(value, { relations: true })) throw new Error('Seed data is not a valid Studieplan envelope.')
    this.save(value, 0, { snapshot: false })
  }

  read() {
    const meta = this.db.prepare('SELECT revision, preferences_json, shape_json FROM state_meta WHERE singleton=1').get()
    const preferences = parse(meta.preferences_json)
    let shape = parse(meta.shape_json)
    // Databases created by the first SQLite delivery stored these exact shape
    // markers beside user preferences. Convert only those known markers; other
    // optional keys, including keys beginning with "__", remain user data.
    const legacyShapeKeys = ['__hasSessions','__hasPlanner','__planner','__hasWorkLogs','__hasImportSources','__has_workWindows','__has_busyWindows']
    if (!Object.keys(shape).length && legacyShapeKeys.some(key => Object.hasOwn(preferences, key))) {
      shape = {
        hasSessions: preferences.__hasSessions,
        hasPlanner: preferences.__hasPlanner,
        planner: preferences.__planner,
        hasWorkLogs: preferences.__hasWorkLogs,
        hasImportSources: preferences.__hasImportSources,
        hasWorkWindows: preferences.__has_workWindows,
        hasBusyWindows: preferences.__has_busyWindows,
      }
      for (const key of legacyShapeKeys) delete preferences[key]
    }
    const rows = table => this.db.prepare(`SELECT payload_json FROM ${table} ORDER BY position`).all().map(row => parse(row.payload_json))
    const courses = rows('courses'), events = rows('planner_events'), sources = rows('planner_sources')
    const state = { ...preferences, schemaVersion: 1, tasks: rows('tasks') }
    const sessions = rows('sessions'); if (sessions.length || shape.hasSessions) state.sessions = sessions
    if (courses.length || events.length || sources.length || shape.hasPlanner) state.planner = { ...(shape.planner || {}), courses, events, sources }
    const workLogs = rows('work_logs'); if (workLogs.length || shape.hasWorkLogs) state.workLogs = workLogs
    const importSources = this.db.prepare('SELECT payload_json, id FROM import_sources ORDER BY position').all().map(row => ({ ...parse(row.payload_json), entries: this.db.prepare('SELECT payload_json FROM import_entries WHERE source_id=? ORDER BY position').all(row.id).map(entry => parse(entry.payload_json)) }))
    if (importSources.length || shape.hasImportSources) state.importSources = importSources
    for (const [key, kind] of [['workWindows', 'work'], ['busyWindows', 'busy']]) {
      const values = this.db.prepare('SELECT payload_json FROM windows WHERE kind=? ORDER BY position').all(kind).map(row => parse(row.payload_json))
      if (values.length || shape[key === 'workWindows' ? 'hasWorkWindows' : 'hasBusyWindows']) state[key] = values
    }
    const history = this.db.prepare('SELECT payload_json FROM history_state WHERE singleton=1').get()
    if (history) state.history = parse(history.payload_json)
    return { revision: meta.revision, envelope: state }
  }

  _replace(envelope, nextRevision) {
    for (const table of ['dependencies','missing_dependencies','import_entries','planner_events','planner_sources','sessions','work_logs','tasks','courses','import_sources','windows','history_state']) this.db.exec(`DELETE FROM ${table}`)
    const insertPayloads = (table, values, columns, fields) => {
      if (!values?.length) return
      const statement = this.db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
      values.forEach((value, position) => statement.run(...fields(value, position), json(value)))
    }
    insertPayloads('courses', envelope.planner?.courses, ['id','position','provider','source_record_id','payload_json'], (v,p) => [v.id,p,v.sourceProvider ?? null,v.sourceRecordId ?? null])
    insertPayloads('tasks', envelope.tasks, ['id','position','course_id','completed','payload_json'], (v,p) => [v.id,p,v.courseId || null,v.completed ? 1 : 0])
    const dependency = this.db.prepare('INSERT INTO dependencies(task_id,prerequisite_id,position,payload_json) VALUES (?,?,?,?)')
    const missingDependency = this.db.prepare('INSERT INTO missing_dependencies(task_id,missing_id,position,payload_json) VALUES (?,?,?,?)')
    for (const task of envelope.tasks) {
      const missing = new Set(task.missingDependencyIds || [])
      ;(task.dependencyIds || task.dependencies || []).forEach((value, position) => {
        const prerequisiteId = typeof value === 'string' ? value : value.taskId
        if (missing.has(prerequisiteId)) missingDependency.run(task.id, prerequisiteId, position, json(value))
        else dependency.run(task.id, prerequisiteId, position, json(value))
      })
    }
    insertPayloads('sessions', envelope.sessions, ['id','position','task_id','date_local','payload_json'], (v,p) => [v.id,p,v.taskId ?? null,v.dateLocal ?? null])
    insertPayloads('work_logs', envelope.workLogs, ['id','position','task_id','operation_id','outcome','payload_json'], (v,p) => [v.id,p,v.taskId ?? null,v.operationId ?? null,v.outcome ?? null])
    insertPayloads('planner_sources', envelope.planner?.sources, ['id','position','course_id','kind','payload_json'], (v,p) => [v.id,p,v.courseId ?? null,v.kind ?? null])
    insertPayloads('planner_events', envelope.planner?.events, ['id','position','course_id','source_id','start_at','payload_json'], (v,p) => [v.id,p,v.courseId || null,v.sourceId ?? null,v.start ?? null])
    const importSource = this.db.prepare('INSERT INTO import_sources(id,position,kind,content_hash,payload_json) VALUES (?,?,?,?,?)')
    const importEntry = this.db.prepare('INSERT INTO import_entries(source_id,entry_key,position,target_id,kind,payload_json) VALUES (?,?,?,?,?,?)')
    ;(envelope.importSources || []).forEach((source, position) => {
      const { entries = [], ...payload } = source
      importSource.run(source.id, position, source.kind ?? null, source.contentHash ?? null, json(payload))
      entries.forEach((entry, entryPosition) => importEntry.run(source.id, entry.key, entryPosition, entry.targetId ?? null, entry.kind ?? null, json(entry)))
    })
    const windowStatement = this.db.prepare('INSERT INTO windows(kind,id,position,payload_json) VALUES (?,?,?,?)')
    for (const [key, kind] of [['workWindows','work'],['busyWindows','busy']]) (envelope[key] || []).forEach((value, position) => windowStatement.run(kind, value.id, position, json(value)))
    if (envelope.history !== undefined) this.db.prepare('INSERT INTO history_state(singleton,payload_json) VALUES (1,?)').run(json(envelope.history))
    const { tasks, sessions, planner, workLogs, importSources, workWindows, busyWindows, history, ...preferences } = envelope
    const shape = {
      hasSessions: sessions !== undefined,
      hasPlanner: planner !== undefined,
      planner: planner ? Object.fromEntries(Object.entries(planner).filter(([key]) => !['courses','events','sources'].includes(key))) : undefined,
      hasWorkLogs: workLogs !== undefined,
      hasImportSources: importSources !== undefined,
      hasWorkWindows: workWindows !== undefined,
      hasBusyWindows: busyWindows !== undefined,
    }
    this.db.prepare("UPDATE state_meta SET revision=?, preferences_json=?, shape_json=?, updated_at=datetime('now') WHERE singleton=1").run(nextRevision, json(preferences), json(shape))
  }

  save(envelope, expectedRevision, { snapshot = false } = {}) {
    if (!validEnvelope(envelope, { relations: true })) throw new TypeError('invalid-envelope')
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.read()
      if (current.revision !== expectedRevision) throw new RevisionConflict(current.revision)
      if (snapshot) {
        this.db.prepare("INSERT INTO recovery_snapshots(created_at,revision,payload_json) VALUES(datetime('now'),?,?)").run(current.revision, json(current.envelope))
        this.db.exec('DELETE FROM recovery_snapshots WHERE id NOT IN (SELECT id FROM recovery_snapshots ORDER BY id DESC LIMIT 20)')
      }
      const nextRevision = current.revision + 1
      this._replace(envelope, nextRevision)
      this.db.exec('COMMIT')
      return { revision: nextRevision, envelope }
    } catch (error) { this.db.exec('ROLLBACK'); throw error }
  }

  previewLegacy(raw) {
    const fingerprint = fingerprintLegacy(raw)
    if (this.db.prepare('SELECT fingerprint FROM legacy_archives WHERE fingerprint=?').get(fingerprint)) return { fingerprint, empty: false, repeated: true, counts: null }
    if (!this.isEmpty()) return { fingerprint, empty: false, repeated: false, counts: null }
    let envelope
    try { envelope = parse(raw) } catch { throw new TypeError('invalid-legacy-json') }
    if (!validEnvelope(envelope, { relations: true })) throw new TypeError('invalid-legacy-envelope')
    return { fingerprint, empty: true, repeated: false, counts: { tasks: envelope.tasks.length, courses: envelope.planner?.courses?.length || 0, sessions: envelope.sessions?.length || 0, workLogs: envelope.workLogs?.length || 0 } }
  }

  importLegacy(raw, fingerprint, expectedRevision) {
    const preview = this.previewLegacy(raw)
    if (preview.fingerprint !== fingerprint) throw new TypeError('legacy-fingerprint-mismatch')
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.read()
      const receipt = this.db.prepare('SELECT fingerprint FROM legacy_archives WHERE fingerprint=?').get(fingerprint)
      if (receipt) { this.db.exec('COMMIT'); return { ...current, repeated: true } }
      if (current.revision !== expectedRevision) throw new RevisionConflict(current.revision)
      if (!this.isEmpty()) throw new TypeError('database-not-empty')
      const envelope = parse(raw), nextRevision = current.revision + 1
      this._replace(envelope, nextRevision)
      this.db.prepare("INSERT INTO legacy_archives(fingerprint,imported_at,raw,revision) VALUES(?,datetime('now'),?,?)").run(fingerprint, raw, nextRevision)
      this.db.exec('COMMIT')
      return { revision: nextRevision, envelope, fingerprint }
    } catch (error) { this.db.exec('ROLLBACK'); throw error }
  }

  recovery() {
    const row = this.db.prepare('SELECT created_at,revision,payload_json FROM recovery_snapshots ORDER BY id DESC LIMIT 1').get()
    return row ? { savedAt: row.created_at, revision: row.revision, data: parse(row.payload_json) } : null
  }

  purge(expectedRevision) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.read()
      if (current.revision !== expectedRevision) throw new RevisionConflict(current.revision)
      const purged = purgeWorkHistory(current.envelope), nextRevision = current.revision + 1
      this._replace(purged, nextRevision)
      const update = this.db.prepare('UPDATE recovery_snapshots SET payload_json=? WHERE id=?')
      for (const row of this.db.prepare('SELECT id,payload_json FROM recovery_snapshots').all()) {
        const value = parse(row.payload_json)
        if (!validEnvelope(value)) throw new TypeError('unreadable-recovery')
        update.run(json(purgeWorkHistory(value)), row.id)
      }
      const updateArchive = this.db.prepare('UPDATE legacy_archives SET raw=? WHERE fingerprint=?')
      for (const row of this.db.prepare('SELECT fingerprint,raw FROM legacy_archives').all()) {
        let value
        try { value = parse(row.raw) } catch { continue }
        if (validEnvelope(value, { relations: true })) updateArchive.run(json(purgeWorkHistory(value)), row.fingerprint)
      }
      this.db.exec('COMMIT')
      return { revision: nextRevision, envelope: purged }
    } catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
}
