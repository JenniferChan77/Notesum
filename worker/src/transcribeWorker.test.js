import { jest } from '@jest/globals'

jest.unstable_mockModule('openai', () => ({
  default: jest.fn(() => ({ audio: { transcriptions: { create: jest.fn() } } })),
}))
jest.unstable_mockModule('../lib/supabase.js', () => ({ supabase: {} }))
jest.unstable_mockModule('../lib/uploadStatus.js', () => ({ setUploadStatus: jest.fn() }))

const { offsetSegments } = await import('./transcribeWorker.js')

describe('offsetSegments', () => {
  const segments = [
    { id: 0, start: 0, end: 4.5, text: ' Hello' },
    { id: 1, start: 4.5, end: 9, text: ' world' },
  ]

  it('shifts start and end by the offset and keeps other fields', () => {
    expect(offsetSegments(segments, 600)).toEqual([
      { id: 0, start: 600, end: 604.5, text: ' Hello' },
      { id: 1, start: 604.5, end: 609, text: ' world' },
    ])
  })

  it('does not mutate the input segments', () => {
    offsetSegments(segments, 600)
    expect(segments[0]).toEqual({ id: 0, start: 0, end: 4.5, text: ' Hello' })
  })

  it('returns an empty list for no segments', () => {
    expect(offsetSegments([], 600)).toEqual([])
  })
})
