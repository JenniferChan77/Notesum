import { Queue } from 'bullmq'
import { POST } from './route'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { queryMock, supabaseMock } from '@/test-utils/supabaseMock'

jest.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('ioredis', () => jest.fn())
jest.mock('bullmq', () => ({ Queue: jest.fn(() => ({ add: jest.fn() })) }))
const mockCreateClient = createServerSupabaseClient as jest.Mock

// The route builds its queue once at import time; grab that instance before any mock reset
const MockQueue = Queue as unknown as jest.Mock
const [queueName, queueOptions] = MockQueue.mock.calls[0]
const mergeQueue = MockQueue.mock.results[0].value as { add: jest.Mock }

function post(body: unknown) {
  return POST(new Request('http://localhost/api/mergeChunk', {
    method: 'POST',
    body: JSON.stringify(body),
  }))
}

function setup(result: { data: unknown; error: unknown }) {
  const uploads = queryMock(result)
  mockCreateClient.mockReturnValue(supabaseMock({ tables: { uploads } }))
  return uploads
}

const validBody = { uploadFileId: 'upload-1', totalChunks: 4, fileType: 'video/mp4' }

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mergeQueue.add.mockResolvedValue({ id: 'job-1' })
})

describe('POST /api/mergeChunk', () => {
  it('creates the merge-chunk queue with retries', () => {
    expect(queueName).toBe('merge-chunk')
    expect(queueOptions.defaultJobOptions).toEqual(expect.objectContaining({ attempts: 3 }))
  })

  it('returns 401 when not signed in', async () => {
    mockCreateClient.mockReturnValue(supabaseMock({ user: null }))

    expect((await post(validBody)).status).toBe(401)
    expect(mergeQueue.add).not.toHaveBeenCalled()
  })

  it.each([0, -2, 1.5, '4', undefined])('returns 400 for totalChunks %p', async (totalChunks) => {
    const uploads = setup({ data: null, error: null })

    const res = await post({ ...validBody, totalChunks })

    expect(res.status).toBe(400)
    expect(uploads.update).not.toHaveBeenCalled()
  })

  it("only flips the row when it is still 'uploading'", async () => {
    const uploads = setup({ data: { id: 'upload-1', file_name: 'stored.mp4' }, error: null })

    await post(validBody)

    expect(uploads.update).toHaveBeenCalledWith({ status: 'queued' })
    expect(uploads.eq).toHaveBeenCalledWith('id', 'upload-1')
    expect(uploads.eq).toHaveBeenCalledWith('status', 'uploading')
  })

  it("returns 404 and enqueues nothing when the row isn't theirs or was already queued", async () => {
    setup({ data: null, error: null })

    const res = await post(validBody)

    expect(res.status).toBe(404)
    expect(mergeQueue.add).not.toHaveBeenCalled()
  })

  it('returns 500 and enqueues nothing when the update fails', async () => {
    setup({ data: null, error: { message: 'db down' } })

    const res = await post(validBody)

    expect(res.status).toBe(500)
    expect(mergeQueue.add).not.toHaveBeenCalled()
  })

  it('enqueues a merge job with the stored file name and returns the job id', async () => {
    setup({ data: { id: 'upload-1', file_name: 'stored.mp4' }, error: null })

    const res = await post({ ...validBody, fileName: 'client-sent.mp4' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ uploadFileId: 'upload-1', jobId: 'job-1' })
    expect(mergeQueue.add).toHaveBeenCalledWith('merge', {
      uploadFileId: 'upload-1',
      totalChunks: 4,
      fileName: 'stored.mp4',
      fileType: 'video/mp4',
    })
  })
})
