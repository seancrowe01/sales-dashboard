/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: string
  readonly VITE_POLL_MS?: string
  readonly VITE_AIRTABLE_CALLS_TABLE?: string
  readonly VITE_AIRTABLE_DM_TABLE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
