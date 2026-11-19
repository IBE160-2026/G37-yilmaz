import { expect, it } from 'vitest'
import { backupFile, exportBackup, MAX_BACKUP_BYTES, previewBackup } from '../../src/backup.js'

const empty = { schemaVersion: 1, tasks: [] }

it('accepts exactly 20,000,000 UTF-8 bytes in the exported file and rejects one byte more', async () => {
  const backup = exportBackup(empty)
  backup.data.syntheticPadding = 'ø'
  const paddingBytes = MAX_BACKUP_BYTES - new Blob([JSON.stringify(backup)]).size
  backup.data.syntheticPadding += 'ø'.repeat(Math.floor(paddingBytes / 2)) + 'x'.repeat(paddingBytes % 2)
  const file = backupFile(backup)
  expect(file.size).toBe(MAX_BACKUP_BYTES)
  const text = await file.text()
  expect(text.length).toBeLessThan(MAX_BACKUP_BYTES)
  expect(previewBackup(text, empty)).toMatchObject({ ok: true })
  expect(previewBackup(`${text} `, empty)).toEqual({ ok: false, error: 'Sikkerhetskopien kan være på maks 20 MB. Eksisterende plan er beholdt.' })
  backup.data.syntheticPadding += 'x'
  expect(() => backupFile(backup)).toThrow('maks 20 MB')
})
