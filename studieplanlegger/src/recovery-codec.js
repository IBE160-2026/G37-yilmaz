import { deflate, Inflate } from 'pako'

// Only the local recovery key is compressed. Main state and portable backups
// remain v1 JSON. Old uncompressed journals remain readable.
const encoding = 'deflate-base64'
const threshold = 100_000
const maxBytes = 50_000_000
const invalid = () => new Error('unreadable-recovery')

function inflateText(payload, limit) {
  if (!payload || payload.length > maxBytes || payload.length % 4 || /[^A-Za-z0-9+/=]/.test(payload)) throw invalid()
  const input = Uint8Array.from(atob(payload), char => char.charCodeAt(0))
  const inflater = new Inflate({ chunkSize: 16_384 }), chunks = []
  let length = 0
  inflater.onData = chunk => {
    length += chunk.length
    // Enforce the actual output limit while expanding, not only afterwards.
    if (length > limit) throw invalid()
    chunks.push(chunk)
  }
  inflater.push(input, true)
  if (inflater.err || !inflater.ended || length !== limit || inflater.strm.avail_in !== 0) throw invalid()
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export function decodeRecoveryJournal(raw) {
  const value = JSON.parse(raw)
  if (!value || !Object.hasOwn(value, 'encoding')) return value
  if (value.version !== 2 || value.encoding !== encoding || !Number.isSafeInteger(value.length) || value.length < 1 || value.length > maxBytes ||
      typeof value.payload !== 'string' || Object.keys(value).some(key => !['version', 'encoding', 'length', 'payload'].includes(key))) throw invalid()
  return JSON.parse(inflateText(value.payload, value.length))
}

export function encodeRecoveryJournal(value) {
  const raw = JSON.stringify(value)
  if (raw.length < threshold) return raw
  // Retain each snapshot once when raw already contains exactly the data copy.
  const compact = item => {
    const copy = { ...item }
    if (typeof copy.raw === 'string' && copy.data && copy.raw === JSON.stringify(copy.data)) delete copy.data
    if (copy.previous) copy.previous = compact(copy.previous)
    return copy
  }
  const text = JSON.stringify(compact(value)), bytes = new TextEncoder().encode(text)
  if (bytes.length > maxBytes) throw new Error('recovery-too-large')
  const compressed = deflate(bytes), parts = []
  for (let offset = 0; offset < compressed.length; offset += 16_384) parts.push(String.fromCharCode(...compressed.subarray(offset, offset + 16_384)))
  const payload = btoa(parts.join(''))
  if (inflateText(payload, bytes.length) !== text) throw invalid()
  const packed = JSON.stringify({ version: 2, encoding, length: bytes.length, payload })
  return packed.length < text.length ? packed : text
}
