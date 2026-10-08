const nextJest = require('next/jest')

// Loads next.config.js + .env files and compiles TS/JSX with Next's SWC setup
const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const config = {
  // API routes and the upload client don't need a DOM; File/Blob/fetch are Node globals
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // The worker is a separate ESM package with its own Jest config
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/worker/'],
  modulePathIgnorePatterns: ['<rootDir>/worker/'],
}

// p-queue (and its p-timeout dep) ship ESM only, so they must be transformed too.
// next/jest always appends '/node_modules/' to transformIgnorePatterns, so replace it after.
module.exports = async () => {
  const resolved = await createJestConfig(config)()
  resolved.transformIgnorePatterns = resolved.transformIgnorePatterns.map((pattern) =>
    pattern === '/node_modules/' ? '/node_modules/(?!(p-queue|p-timeout)/)' : pattern
  )
  return resolved
}
