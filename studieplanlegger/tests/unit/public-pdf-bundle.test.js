import { cp, glob, mkdtemp, readFile, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it('extracts PDF text from only the explicitly packaged Vercel PDF dependencies', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const config = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'))
  const bundle = await mkdtemp(join(tmpdir(), 'ajour-pdf-bundle-'))
  try {
    // Worker entrypoints are explicitly included, so their dynamic dependencies
    // must also be included. Isolate from workspace node_modules to expose gaps.
    for await (const path of glob(config.functions['api/handler.js'].includeFiles, { cwd: root })) {
      if (path.startsWith('node_modules')) await cp(join(root, path), join(bundle, path), { recursive: true })
    }
    const fixture = resolve(root, 'tests/fixtures/uit-programs/pdf/868803.pdf')
    const script = `import {readFile} from 'node:fs/promises';
      import {getDocument} from './node_modules/pdfjs-dist/legacy/build/pdf.mjs';
      const loading=getDocument({data:new Uint8Array(await readFile(process.argv[1])),isEvalSupported:false});
      try {const doc=await loading.promise;let characters=0;for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);characters+=(await page.getTextContent()).items.reduce((sum,item)=>sum+(item.str?.length||0),0);page.cleanup();}console.log(JSON.stringify({pages:doc.numPages,characters}));}finally{await loading.destroy();}`
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', script, fixture], { cwd: bundle, timeout: 20000 })
    const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1))
    expect(result.pages).toBeGreaterThan(1)
    expect(result.characters).toBeGreaterThan(100)
  } finally {
    if (dirname(resolve(bundle)) !== resolve(tmpdir()) || !basename(bundle).startsWith('ajour-pdf-bundle-')) throw new Error('Refusing cleanup outside isolated PDF test directory')
    await rm(bundle, { recursive: true, force: true })
  }
}, 30000)
