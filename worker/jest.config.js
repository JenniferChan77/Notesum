// The worker is native ESM ("type": "module"), so tests run untransformed under
// --experimental-vm-modules (see the "test" script) and mock with jest.unstable_mockModule.
export default {
  testEnvironment: 'node',
  transform: {},
}
