/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL including `/api`, e.g. `http://localhost:5003/api`. */
  readonly VITE_API_BASE_URL?: string;
  /** Google OAuth client ID for "Login with Google". Without it the button is hidden. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
