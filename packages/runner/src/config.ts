export type RunnerLogger = {
  info: (msg: string, data?: Record<string, unknown>) => void
  error: (msg: string, data?: Record<string, unknown>) => void
}

const noop: RunnerLogger = {
  info: () => {},
  error: () => {},
}

let logger: RunnerLogger = noop

export function configureRunner(input: { logger: RunnerLogger }) {
  logger = input.logger
}

export function getLogger() {
  return logger
}
