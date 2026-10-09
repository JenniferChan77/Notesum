import { jest } from '@jest/globals'

// supabase.from('uploads').update({...}).eq('id', id)
const eq = jest.fn()
const update = jest.fn(() => ({ eq }))
const from = jest.fn(() => ({ update }))
jest.unstable_mockModule('./supabase.js', () => ({ supabase: { from } }))

const { setUploadStatus, markFailedIfFinal } = await import('./uploadStatus.js')

beforeEach(() => {
  jest.clearAllMocks()
  eq.mockResolvedValue({ error: null })
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('setUploadStatus', () => {
  it('updates status and error on the matching uploads row', async () => {
    await setUploadStatus('u1', 'processing')

    expect(from).toHaveBeenCalledWith('uploads')
    expect(update).toHaveBeenCalledWith({ status: 'processing', error: null })
    expect(eq).toHaveBeenCalledWith('id', 'u1')
  })

  it('passes the error message through', async () => {
    await setUploadStatus('u1', 'failed', 'boom')
    expect(update).toHaveBeenCalledWith({ status: 'failed', error: 'boom' })
  })

  it('logs instead of throwing when the update fails', async () => {
    eq.mockResolvedValue({ error: { message: 'db down' } })

    await expect(setUploadStatus('u1', 'completed')).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('markFailedIfFinal', () => {
  const job = (attemptsMade, attempts) => ({
    data: { uploadFileId: 'u1' },
    attemptsMade,
    opts: attempts === undefined ? {} : { attempts },
  })

  it('ignores a missing job', async () => {
    await markFailedIfFinal(undefined, new Error('boom'))
    expect(from).not.toHaveBeenCalled()
  })

  it('does not mark failed while retries remain', async () => {
    await markFailedIfFinal(job(1, 3), new Error('boom'))
    await markFailedIfFinal(job(2, 3), new Error('boom'))
    expect(from).not.toHaveBeenCalled()
  })

  it('marks failed with the error message on the final attempt', async () => {
    await markFailedIfFinal(job(3, 3), new Error('boom'))

    expect(update).toHaveBeenCalledWith({ status: 'failed', error: 'boom' })
    expect(eq).toHaveBeenCalledWith('id', 'u1')
  })

  it('treats a job without an attempts option as single-attempt', async () => {
    await markFailedIfFinal(job(1, undefined), new Error('boom'))
    expect(update).toHaveBeenCalledWith({ status: 'failed', error: 'boom' })
  })

  it("falls back to 'Unknown error' when there is no error", async () => {
    await markFailedIfFinal(job(3, 3), undefined)
    expect(update).toHaveBeenCalledWith({ status: 'failed', error: 'Unknown error' })
  })
})
