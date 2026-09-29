// Types for sheets.mjs, so the TypeScript tests can import it. The server itself is plain
// JavaScript on purpose: it runs straight on node with no build step and no dependencies.

export interface SheetRecord {
  id: string
  fields: Record<string, string>
}

export interface ServiceAccount {
  email: string
  privateKey: string
}

export function normalizePrivateKey(raw: unknown): string

export function buildJwt(
  options: { email: string; privateKey: string; scope?: string; now?: number },
  cryptoImpl: typeof import('node:crypto'),
): string

export function rowsToRecords(values: unknown[][], idPrefix: string): SheetRecord[]

export function friendlySheetsMessage(err: unknown): string

export declare class SheetsSource {
  constructor(options: {
    sheetId: string
    tabs: { calls: string; dm: string }
    serviceAccount?: ServiceAccount | null
    apiKey?: string
    fetchImpl?: typeof fetch
    cryptoImpl?: typeof import('node:crypto')
    log?: (message: string) => void
  })
  readonly name: string
  readonly configured: boolean
  missingSettings(): string[]
  accessToken(): Promise<string | null>
  fetchTab(tabName: string, idPrefix: string): Promise<SheetRecord[]>
  fetchAll(): Promise<{ calls: SheetRecord[]; dm: SheetRecord[] }>
}
