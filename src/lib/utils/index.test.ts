import { cn, formatDuration } from './index'

describe('cn', () => {
  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c')
  })

  it('lets later Tailwind classes win conflicts', () => {
    expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4')
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [59.9, '0:59'],
    [65, '1:05'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
  ])('%d -> %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected)
  })
})
