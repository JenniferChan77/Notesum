import { NextRequest } from 'next/server'
import { POST } from './route'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { queryMock, supabaseMock } from '@/test-utils/supabaseMock'

jest.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: jest.fn() }))
const mockCreateClient = createServerSupabaseClient as jest.Mock

function post(body: unknown) {
  return POST(new NextRequest('http://localhost/api/uploads', {
    method: 'POST',
    body: JSON.stringify(body),
  }))
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/uploads', () => {
  it('returns 401 when not signed in', async () => {
    const uploads = queryMock()
    mockCreateClient.mockReturnValue(supabaseMock({ user: null, tables: { uploads } }))

    const res = await post({ fileName: 'lecture.mp4' })

    expect(res.status).toBe(401)
    expect(uploads.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', {}],
    ['blank', { fileName: '   ' }],
    ['not a string', { fileName: 42 }],
  ])('returns 400 when fileName is %s', async (_label, body) => {
    const uploads = queryMock()
    mockCreateClient.mockReturnValue(supabaseMock({ tables: { uploads } }))

    const res = await post(body)

    expect(res.status).toBe(400)
    expect(uploads.insert).not.toHaveBeenCalled()
  })

  it("creates an 'uploading' row owned by the caller and returns its id", async () => {
    const uploads = queryMock({ data: { id: 'upload-1' }, error: null })
    mockCreateClient.mockReturnValue(supabaseMock({ tables: { uploads } }))

    const res = await post({ fileName: 'lecture.mp4' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ uploadFileId: 'upload-1' })
    expect(uploads.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      file_name: 'lecture.mp4',
      status: 'uploading',
    })
  })

  it('returns 500 when the insert fails', async () => {
    const uploads = queryMock({ data: null, error: { message: 'insert failed' } })
    mockCreateClient.mockReturnValue(supabaseMock({ tables: { uploads } }))

    const res = await post({ fileName: 'lecture.mp4' })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'insert failed' })
  })
})
