import { defineConfig } from 'vitest/config'

// The unit tests cover the pure logic: projection maths, tile planning and the
// puzzle rules. None of it touches a canvas or the network, so it runs in a
// plain node environment and stays fast.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
