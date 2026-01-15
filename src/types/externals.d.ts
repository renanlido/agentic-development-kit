declare module 'zod' {
  export interface ZodType<T = unknown> {
    parse(data: unknown): T
    safeParse(data: unknown): { success: true; data: T } | { success: false; error: ZodError }
  }

  export interface ZodError {
    errors: Array<{ path: (string | number)[]; message: string }>
  }

  export interface ZodString extends ZodType<string> {
    min(length: number, message?: string): ZodString
  }

  export interface ZodNumber extends ZodType<number> {}

  export interface ZodBoolean extends ZodType<boolean> {
    default(value: boolean): ZodBoolean
  }

  export interface ZodArray<T> extends ZodType<T[]> {
    min(length: number, message?: string): ZodArray<T>
  }

  export interface ZodObject<T> extends ZodType<T> {
    optional(): ZodType<T | undefined>
  }

  export interface ZodEnum<T extends string> extends ZodType<T> {
    default(value: T): ZodEnum<T>
  }

  export const z: {
    string(): ZodString
    number(): ZodNumber
    boolean(): ZodBoolean
    array<T>(schema: ZodType<T>): ZodArray<T>
    object<T extends Record<string, ZodType>>(
      shape: T
    ): ZodObject<{ [K in keyof T]: T[K] extends ZodType<infer U> ? U : never }>
    enum<T extends readonly string[]>(values: T): ZodEnum<T[number]>
    infer: <T extends ZodType>() => T extends ZodType<infer U> ? U : never
  }

  export function infer<T extends ZodType>(): T extends ZodType<infer U> ? U : never
}

declare module 'fuse.js' {
  interface FuseOptions<_T> {
    keys?: Array<string | { name: string; weight: number }>
    threshold?: number
    includeScore?: boolean
    includeMatches?: boolean
    ignoreLocation?: boolean
    findAllMatches?: boolean
  }

  interface FuseResult<T> {
    item: T
    score?: number
    matches?: Array<{ key?: string; value?: string }>
  }

  class Fuse<T> {
    constructor(list: T[], options?: FuseOptions<T>)
    search(query: string): FuseResult<T>[]
  }

  export default Fuse
  export { FuseOptions, FuseResult }
}

declare module 'simple-git' {
  interface BranchSummary {
    current: string
    all: string[]
  }

  interface StatusResult {
    modified: string[]
    created: string[]
    renamed: Array<{ from: string; to: string }>
  }

  interface LogResult {
    latest?: { hash: string }
  }

  interface VersionResult {
    installed: boolean
    major: number
    minor: number
    patch: number
  }

  interface SimpleGit {
    version(): Promise<VersionResult>
    branchLocal(): Promise<BranchSummary>
    checkout(branch: string): Promise<void>
    checkoutLocalBranch(branch: string): Promise<void>
    raw(args: string[]): Promise<string>
    status(): Promise<StatusResult>
    add(files: string | string[]): Promise<void>
    commit(message: string): Promise<{ commit: string }>
    merge(args: string[]): Promise<void>
    reset(args: string[]): Promise<void>
    log(options?: { n?: number }): Promise<LogResult>
  }

  export function simpleGit(cwd?: string): SimpleGit
  export type { SimpleGit, BranchSummary, StatusResult, VersionResult }
}
