import { formatTime } from './formatTime'

describe('formatTime', () => {
  it.each([
    [0, '00:00'],
    [59.9, '00:59'],
    [75.4, '01:15'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
  ])('%d -> %s', (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected)
  })
})
