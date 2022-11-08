export interface Log {
  warning: (msg: string) => void
  error: (msg: string) => void
  notice: (msg: string) => void
  info: (msg: string) => void
  debug: (msg: string) => void
}
