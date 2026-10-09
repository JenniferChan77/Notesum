import { chunkFile } from './chunkFile'

const MB = 1024 * 1024

function blobOfSize(bytes: number) {
  return new Blob([new Uint8Array(bytes)])
}

describe('chunkFile', () => {
  it('returns no chunks for an empty file', () => {
    expect(chunkFile(blobOfSize(0))).toEqual([])
  })

  it('returns a single chunk for a file of exactly the chunk size', () => {
    const chunks = chunkFile(blobOfSize(10 * MB))
    expect(chunks).toHaveLength(1)
    expect(chunks[0].size).toBe(10 * MB)
  })

  it('puts the remainder in a final, smaller chunk', () => {
    const chunks = chunkFile(blobOfSize(10 * MB + 1))
    expect(chunks.map((c: Blob) => c.size)).toEqual([10 * MB, 1])
  })

  it('respects a custom chunk size', () => {
    const chunks = chunkFile(blobOfSize(10), 3)
    expect(chunks.map((c: Blob) => c.size)).toEqual([3, 3, 3, 1])
  })

  it('preserves byte order across chunks', async () => {
    const bytes = Uint8Array.from({ length: 10 }, (_, i) => i)
    const chunks = chunkFile(new Blob([bytes]), 4)
    const joined = new Uint8Array(await new Blob(chunks).arrayBuffer())
    expect(Array.from(joined)).toEqual(Array.from(bytes))
  })
})
