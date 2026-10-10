import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Only source tests; a stale `build/` folder must never be picked up.
    include: ['tests/**/*.test.ts'],
    // Injected before any module loads so `src/config/env.ts` (which throws on
    // missing required vars) can be imported safely inside tests.
    env: {
      NODE_ENV: 'test',
      MONGO_URI: 'mongodb://127.0.0.1:27017/placeholder-replaced-by-memory-server',
      JWT_SECRET: 'test_jwt_secret',
      JWT_EXPIRES_IN: '1h',
      CLIENT_URL: 'http://localhost:5173',
      EMAIL_FROM: 'test@example.com',
      OTP_EXPIRES_MINUTES: '10',
      RESET_TOKEN_EXPIRES_MINUTES: '15',
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
      GEMINI_API_KEY: 'test-gemini-key',
      GEMINI_MODEL: 'test-model',
      GOOGLE_CLIENT_ID: 'test-google-client-id'
    },
    globalSetup: ['./tests/setup/download-mongod.ts'],
    setupFiles: ['./tests/setup/mock-external-services.ts', './tests/setup/in-memory-database.ts'],
    testTimeout: 20000,
    // The mongod binary is downloaded once in globalSetup, so starting it per file
    // is quick. A short timeout makes a broken start fail fast instead of hanging.
    hookTimeout: 30000,
    restoreMocks: true
  }
});
