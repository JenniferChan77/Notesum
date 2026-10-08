import { NextRequest } from 'next/server'
import { POST } from './route'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { queryMock, supabaseMock } from '@/test-utils/supabaseMock'

jest.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: jest.fn() }))
const mockCreateClient = createServerSupabaseClient as jest.Mock

const storedUpload = { id: 'upload-1', file_name: 'stored.mp4', status: 'uploading' }

function post(body: unknown) {
  return POST(new NextRequest('http://localhost/api/getSignedUrl', {
    method: 'POST',
    body: JSON.stringify(body),
  }))
}

function setup(uploadRow: unknown = storedUpload, signed = { data: { signedUrl: 'https://signed' }, error: null }) {
  const uploads = queryMock({ data: uploadRow, error: null })
  const createSignedUploadUrl = jest.fn(async () => signed)
  const supabase = supabaseMock({ tables: { uploads }, storage: { createSignedUploadUrl } })
  mockCreateClient.mockReturnValue(supabase)
  return { supabase, createSignedUploadUrl }
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/getSignedUrl', () => {
  it('returns 401 when not signed in', async () => {
    mockCreateClient.mockReturnValue(supabaseMock({ user: null }))
    expect((await post({ uploadFileId: 'upload-1', chunkIndex: 0 })).status).toBe(401)
  })

  it.each([-1, 1.5, '0', undefined])('returns 400 for chunkIndex %p', async (chunkIndex) => {
    const { createSignedUploadUrl } = setup()

    const res = await post({ uploadFileId: 'upload-1', chunkIndex })

    expect(res.status).toBe(400)
    expect(createSignedUploadUrl).not.toHaveBeenCalled()
  })

  it("returns 404 when the upload isn't visible", async () => {
    setup(null)
    expect((await post({ uploadFileId: 'upload-1', chunkIndex: 0 })).status).toBe(404)
  })

  it("returns 409 once the upload has left 'uploading'", async () => {
    const { createSignedUploadUrl } = setup({ ...storedUpload, status: 'queued' })

    const res = await post({ uploadFileId: 'upload-1', chunkIndex: 0 })

    expect(res.status).toBe(409)
    expect(createSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('signs the chunk path built from the stored file name, ignoring any client-sent name', async () => {
    const { supabase, createSignedUploadUrl } = setup()

    const res = await post({ uploadFileId: 'upload-1', chunkIndex: 3, fileName: '../evil.mp4' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ signedUrl: 'https://signed' })
    expect(supabase.storage.from).toHaveBeenCalledWith('audio-temp')
    expect(createSignedUploadUrl).toHaveBeenCalledWith('temp/upload-1/3-stored.mp4')
  })

  it('returns 500 when signing fails', async () => {
    setup(storedUpload, { data: null as never, error: { message: 'storage down' } as never })
    expect((await post({ uploadFileId: 'upload-1', chunkIndex: 0 })).status).toBe(500)
  })
})
