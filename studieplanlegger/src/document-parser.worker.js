import { parseDocumentBytes } from './document-parsers.js'

// Parsers receive only bytes. Dynamic JS chunks are bundled locally by Vite;
// document-provided URLs can never trigger an upload or resource fetch.
globalThis.fetch = () => Promise.reject(new Error('Dokumentimport har ikke nettverkstilgang.'))
globalThis.XMLHttpRequest = class { constructor() { throw new Error('Dokumentimport har ikke nettverkstilgang.') } }
self.onmessage = async ({ data }) => {
  try {
    const parsed = await parseDocumentBytes(data.buffer, { ...data.options, onProgress: message => self.postMessage({ documentImport: true, progress: message }) })
    self.postMessage({ documentImport: true, ok: true, parsed })
  } catch (error) { self.postMessage({ documentImport: true, ok: false, error: error.message || 'Dokumentet kunne ikke leses. Lim inn teksten eller registrer planen manuelt.' }) }
}
