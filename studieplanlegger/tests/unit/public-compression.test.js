import {describe,it,expect}from'vitest'
import {gzipSync,deflateSync,brotliCompressSync}from'node:zlib'
import{decodePublicContent}from'../../server/import-api.js'
describe('public HTTP content encoding stays bounded',()=>{
  it.each([['gzip',gzipSync],['deflate',deflateSync],['br',brotliCompressSync]])('decodes declared %s while retaining exact source bytes',async(type,encode)=>{
    const bytes=Buffer.from('<h1>Publisert studieplan – vår 2026</h1>')
    expect(await decodePublicContent(encode(bytes),type,1000)).toEqual(bytes)
  })
  it('limits the expanded size and rejects malformed or unsupported encodings',async()=>{
    await expect(decodePublicContent(gzipSync(Buffer.alloc(5000,'a')),'gzip',1000)).rejects.toThrow('større')
    await expect(decodePublicContent(Buffer.from('not gzip'),'gzip',1000)).rejects.toThrow('ugyldig')
    await expect(decodePublicContent(Buffer.from('text'),'unknown',1000)).rejects.toThrow('ikke støttes')
    const bytes=Buffer.from('%PDF-1.7');expect(await decodePublicContent(bytes,undefined,1000)).toBe(bytes)
  })
})
