import { uploadFile } from './uploadFile'
import { chunkFile } from '@/lib/utils/chunkFile'

// chunkFile has its own tests; stubbing it avoids allocating 10MB+ files to get several chunks
jest.mock('@/lib/utils/chunkFile', () => ({ chunkFile: jest.fn() }))
const mockChunkFile = chunkFile as jest.Mock

const file = new File(['ignored'], 'lecture.mp4', { type: 'video/mp4' })
const chunks = (n: number) => Array.from({ length: n }, (_, i) => new Blob([`chunk-${i}`]))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

type Handler = (init: RequestInit) => Response | Promise<Response>

// Routes fetch() by URL; each test overrides only the endpoints it cares about
function mockFetch(overrides: Record<string, Handler> = {}) {
  const handlers: Record<string, Handler> = {
    '/api/uploads': () => json({ uploadFileId: 'upload-1' }),
    '/api/getSignedUrl': (init) => json({ signedUrl: `https://storage/${JSON.parse(init.body as string).chunkIndex}` }),
    'PUT': () => new Response(null, { status: 200 }),
    '/api/mergeChunk': () => json({ uploadFileId: 'upload-1', jobId: 'job-1' }),
    ...overrides,
  }
  const fetchMock = jest.fn(async (url: string, init: RequestInit) =>
    handlers[init.method === 'PUT' ? 'PUT' : url](init)
  )
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

const callsTo = (fetchMock: jest.Mock, url: string) => fetchMock.mock.calls.filter(([u]) => u === url)
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string)

beforeEach(() => jest.clearAllMocks())

describe('uploadFile', () => {
  it('creates the upload, PUTs every chunk to its signed URL, then queues the merge', async () => {
    const parts = chunks(3)
    mockChunkFile.mockReturnValue(parts)
    const fetchMock = mockFetch()

    await expect(uploadFile(file)).resolves.toBe('upload-1')

    const urls = fetchMock.mock.calls.map(([url]) => url)
    expect(urls[0]).toBe('/api/uploads')
    expect(urls[urls.length - 1]).toBe('/api/mergeChunk')
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({ fileName: 'lecture.mp4' })

    expect(callsTo(fetchMock, '/api/getSignedUrl').map(bodyOf)).toEqual(
      expect.arrayContaining([0, 1, 2].map((chunkIndex) => ({ uploadFileId: 'upload-1', chunkIndex })))
    )
    parts.forEach((part, i) => {
      expect(fetchMock).toHaveBeenCalledWith(`https://storage/${i}`, expect.objectContaining({ method: 'PUT', body: part }))
    })

    expect(bodyOf(callsTo(fetchMock, '/api/mergeChunk')[0])).toEqual({
      uploadFileId: 'upload-1',
      totalChunks: 3,
      fileType: 'video/mp4',
    })
  })

  it('never uploads more than 3 chunks at once', async () => {
    mockChunkFile.mockReturnValue(chunks(7))
    let inFlight = 0
    let maxInFlight = 0
    const fetchMock = mockFetch({
      PUT: async () => {
        maxInFlight = Math.max(maxInFlight, ++inFlight)
        await new Promise((resolve) => setTimeout(resolve, 5))
        inFlight--
        return new Response(null, { status: 200 })
      },
    })

    await uploadFile(file)

    expect(maxInFlight).toBe(3)
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'PUT')).toHaveLength(7)
  })

  it("rejects and doesn't queue the merge when a chunk PUT fails", async () => {
    mockChunkFile.mockReturnValue(chunks(3))
    const fetchMock = mockFetch({
      PUT: () => new Response(null, { status: 500 }),
    })

    await expect(uploadFile(file)).rejects.toThrow(/^Chunk \d upload failed \(500\)$/)
    expect(callsTo(fetchMock, '/api/mergeChunk')).toHaveLength(0)
  })

  it("surfaces the server's error message and doesn't queue the merge when signing fails", async () => {
    mockChunkFile.mockReturnValue(chunks(2))
    const fetchMock = mockFetch({
      '/api/getSignedUrl': () => json({ error: 'Upload is no longer accepting chunks' }, 409),
    })

    await expect(uploadFile(file)).rejects.toThrow('Upload is no longer accepting chunks')
    expect(callsTo(fetchMock, '/api/mergeChunk')).toHaveLength(0)
  })

  it('uploads nothing when the upload record cannot be created', async () => {
    mockChunkFile.mockReturnValue(chunks(2))
    const fetchMock = mockFetch({
      '/api/uploads': () => json({ error: 'Not signed in' }, 401),
    })

    await expect(uploadFile(file)).rejects.toThrow('Not signed in')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to a generic message when the error body is not JSON', async () => {
    mockChunkFile.mockReturnValue(chunks(1))
    mockFetch({
      '/api/mergeChunk': () => new Response('<html>Bad Gateway</html>', { status: 502 }),
    })

    await expect(uploadFile(file)).rejects.toThrow('/api/mergeChunk failed (502)')
  })
})
