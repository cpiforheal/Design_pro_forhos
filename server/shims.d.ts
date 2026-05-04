declare module 'sql.js' {
  export interface QueryExecResult {
    columns: string[]
    values: unknown[][]
  }

  export interface Statement {
    bind(params?: Record<string, unknown>): boolean
    step(): boolean
    getAsObject(): Record<string, unknown>
    get(): unknown[]
    run(params?: Record<string, unknown>): void
    free(): void
  }

  export interface Database {
    exec(sql: string): QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database
  }

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string
  }

  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>
}
