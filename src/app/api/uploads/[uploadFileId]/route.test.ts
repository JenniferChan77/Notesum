import { NextRequest } from 'next/server'
import { GET } from './route'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { queryMock, supabaseMock } from '@/test-utils/supabaseMock'

jest.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: jest.fn() }))
const mockCreateClient = createServerSupabaseClient as jest.Mock

const upload = (status: string) => ({
  id: 'upload-1',
  file_name: 'lecture.mp4',
  status,
  error: null,
  updated_at: '2026-10-08T00:00:00Z',
})

function get() {
  return GET(new NextRequest('http://localhost/api/uploads/upload-1'), {
    params: { uploadFileId: 'upload-1' },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/uploads/[uploadFileId]', () => {
  it('returns 401 when not signed in', async () => {
    mockCreateClient.mockReturnValue(supabaseMock({ user: null }))
    expect((await get()).status).toBe(401)
  })

  it("returns 404 when the row isn't visible (missing or another user's)", async () => {
    const uploads = queryMock({ data: null, error: null })
    mockCreateClient.mockReturnValue(supabaseMock({ tables: { uploads } }))

    const res = await get()

    expect(res.status).toBe(404)
    expect(uploads.eq).toHaveBeenCalledWith('id', 'upload-1')
  })

  it('returns 500 when the uploads query fails', async () => {
    const uploads = queryMock({ data: null, error: { message: 'db down' } })
    mockCreateClient.mockReturnValue(supabaseMock({ tables: { uploads } }))

    const res = await get()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'db down' })
  })

  it('returns the status with a null transcript, without querying transcriptions, until completed', async () => {
    const uploads = queryMock({ data: upload('transcribing'), error: null })
    const transcriptions = queryMock()
    const supabase = supabaseMock({ tables: { uploads, transcriptions } })
    mockCreateClient.mockReturnValue(supabase)

    const res = await get()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ...upload('transcribing'), transcript: null })
    expect(supabase.from).not.toHaveBeenCalledWith('transcriptions')
  })

  it('attaches the transcript once completed', async () => {
    const transcript = { text: 'Hello world', segments: [{ id: 0, start: 0, end: 2, text: ' Hello world' }] }
    const uploads = queryMock({ data: upload('completed'), error: null })
    const transcriptions = queryMock({ data: transcript, error: null })
    mockCreateClient.mockReturnValue(supabaseMock({ tables: { uploads, transcriptions } }))

    const res = await get()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ...upload('completed'), transcript })
    expect(transcriptions.eq).toHaveBeenCalledWith('video_id', 'upload-1')
  })

  it('returns 500 when the transcript query fails', async () => {
    const uploads = queryMock({ data: upload('completed'), error: null })
    const transcriptions = queryMock({ data: null, error: { message: 'transcript read failed' } })
    mockCreateClient.mockReturnValue(supabaseMock({ tables: { uploads, transcriptions } }))

    const res = await get()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'transcript read failed' })
  })
})
