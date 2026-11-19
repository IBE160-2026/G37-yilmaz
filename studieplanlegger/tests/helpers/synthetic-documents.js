import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const JSZip = createRequire(require.resolve('mammoth'))('jszip')

// Minimal invented PDF with no source metadata; lines are ordinary Helvetica text.
export function syntheticPdf(lines) {
  const escape = line => line.replace(/[()\\\x80-\xff]/g, char => '\\' + (char.charCodeAt(0) > 127 ? char.charCodeAt(0).toString(8) : char))
  const text = lines.map(line => '(' + escape(line) + ') Tj').join(' T* ')
  const stream = 'BT /F1 10 Tf 18 TL 40 750 Td ' + text + ' ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Length ' + Buffer.byteLength(stream) + ' >>\nstream\n' + stream + '\nendstream',
  ]
  let content = '%PDF-1.4\n'
  const offsets = []
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(content))
    content += (index + 1) + ' 0 obj\n' + object + '\nendobj\n'
  }
  const start = Buffer.byteLength(content)
  content += 'xref\n0 6\n0000000000 65535 f \n'
  content += offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')
  content += 'trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n' + start + '\n%%EOF'
  return Buffer.from(content)
}

export async function syntheticDocx(lines) {
  // Reuse the verified metadata-free synthetic fixture and replace only its body.
  const zip = await JSZip.loadAsync(await readFile(new URL('../fixtures/connected-semester.docx', import.meta.url)))
  const paragraphs = lines.map(line => '<w:p><w:r><w:t>' + line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') + '</w:t></w:r></w:p>').join('')
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs + '</w:body></w:document>')
  return zip.generateAsync({ type: 'nodebuffer' })
}
