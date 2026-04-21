function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function falsy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "false" || value === "0"
}

export namespace Flag {
  export const PALIMPSEST_AUTO_SHARE = truthy("PALIMPSEST_AUTO_SHARE")
  export const PALIMPSEST_GIT_BASH_PATH = process.env["PALIMPSEST_GIT_BASH_PATH"]
  export const PALIMPSEST_CONFIG = process.env["PALIMPSEST_CONFIG"]
  export declare const PALIMPSEST_TUI_CONFIG: string | undefined
  export declare const PALIMPSEST_CONFIG_DIR: string | undefined
  export const PALIMPSEST_CONFIG_CONTENT = process.env["PALIMPSEST_CONFIG_CONTENT"]
  export const PALIMPSEST_DISABLE_AUTOUPDATE = truthy("PALIMPSEST_DISABLE_AUTOUPDATE")
  export const PALIMPSEST_DISABLE_PRUNE = truthy("PALIMPSEST_DISABLE_PRUNE")
  export const PALIMPSEST_DISABLE_TERMINAL_TITLE = truthy("PALIMPSEST_DISABLE_TERMINAL_TITLE")
  export const PALIMPSEST_PERMISSION = process.env["PALIMPSEST_PERMISSION"]
  export const PALIMPSEST_DISABLE_DEFAULT_PLUGINS = truthy("PALIMPSEST_DISABLE_DEFAULT_PLUGINS")
  export const PALIMPSEST_DISABLE_LSP_DOWNLOAD = truthy("PALIMPSEST_DISABLE_LSP_DOWNLOAD")
  export const PALIMPSEST_ENABLE_EXPERIMENTAL_MODELS = truthy("PALIMPSEST_ENABLE_EXPERIMENTAL_MODELS")
  export const PALIMPSEST_DISABLE_AUTOCOMPACT = truthy("PALIMPSEST_DISABLE_AUTOCOMPACT")
  export const PALIMPSEST_DISABLE_MODELS_FETCH = truthy("PALIMPSEST_DISABLE_MODELS_FETCH")
  export const PALIMPSEST_DISABLE_CLAUDE_CODE = truthy("PALIMPSEST_DISABLE_CLAUDE_CODE")
  export const PALIMPSEST_DISABLE_CLAUDE_CODE_PROMPT =
    PALIMPSEST_DISABLE_CLAUDE_CODE || truthy("PALIMPSEST_DISABLE_CLAUDE_CODE_PROMPT")
  export const PALIMPSEST_DISABLE_CLAUDE_CODE_SKILLS =
    PALIMPSEST_DISABLE_CLAUDE_CODE || truthy("PALIMPSEST_DISABLE_CLAUDE_CODE_SKILLS")
  export const PALIMPSEST_DISABLE_EXTERNAL_SKILLS =
    PALIMPSEST_DISABLE_CLAUDE_CODE_SKILLS || truthy("PALIMPSEST_DISABLE_EXTERNAL_SKILLS")
  export declare const PALIMPSEST_DISABLE_PROJECT_CONFIG: boolean
  export const PALIMPSEST_FAKE_VCS = process.env["PALIMPSEST_FAKE_VCS"]
  export declare const PALIMPSEST_CLIENT: string
  export const PALIMPSEST_SERVER_PASSWORD = process.env["PALIMPSEST_SERVER_PASSWORD"]
  export const PALIMPSEST_SERVER_USERNAME = process.env["PALIMPSEST_SERVER_USERNAME"]
  export const PALIMPSEST_ENABLE_QUESTION_TOOL = truthy("PALIMPSEST_ENABLE_QUESTION_TOOL")

  // Experimental
  export const PALIMPSEST_EXPERIMENTAL = truthy("PALIMPSEST_EXPERIMENTAL")
  export const PALIMPSEST_EXPERIMENTAL_FILEWATCHER = truthy("PALIMPSEST_EXPERIMENTAL_FILEWATCHER")
  export const PALIMPSEST_EXPERIMENTAL_DISABLE_FILEWATCHER = truthy("PALIMPSEST_EXPERIMENTAL_DISABLE_FILEWATCHER")
  export const PALIMPSEST_EXPERIMENTAL_ICON_DISCOVERY =
    PALIMPSEST_EXPERIMENTAL || truthy("PALIMPSEST_EXPERIMENTAL_ICON_DISCOVERY")

  const copy = process.env["PALIMPSEST_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
  export const PALIMPSEST_EXPERIMENTAL_DISABLE_COPY_ON_SELECT =
    copy === undefined ? process.platform === "win32" : truthy("PALIMPSEST_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const PALIMPSEST_ENABLE_EXA =
    truthy("PALIMPSEST_ENABLE_EXA") || PALIMPSEST_EXPERIMENTAL || truthy("PALIMPSEST_EXPERIMENTAL_EXA")
  export const PALIMPSEST_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("PALIMPSEST_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  export const PALIMPSEST_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("PALIMPSEST_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const PALIMPSEST_EXPERIMENTAL_OXFMT = PALIMPSEST_EXPERIMENTAL || truthy("PALIMPSEST_EXPERIMENTAL_OXFMT")
  export const PALIMPSEST_EXPERIMENTAL_LSP_TY = truthy("PALIMPSEST_EXPERIMENTAL_LSP_TY")
  export const PALIMPSEST_EXPERIMENTAL_LSP_TOOL = PALIMPSEST_EXPERIMENTAL || truthy("PALIMPSEST_EXPERIMENTAL_LSP_TOOL")
  export const PALIMPSEST_DISABLE_FILETIME_CHECK = truthy("PALIMPSEST_DISABLE_FILETIME_CHECK")
  export const PALIMPSEST_EXPERIMENTAL_PLAN_MODE = PALIMPSEST_EXPERIMENTAL || truthy("PALIMPSEST_EXPERIMENTAL_PLAN_MODE")
  export const PALIMPSEST_EXPERIMENTAL_MARKDOWN = !falsy("PALIMPSEST_EXPERIMENTAL_MARKDOWN")
  export const PALIMPSEST_MODELS_URL = process.env["PALIMPSEST_MODELS_URL"]
  export const PALIMPSEST_MODELS_PATH = process.env["PALIMPSEST_MODELS_PATH"]
  export const PALIMPSEST_DISABLE_CHANNEL_DB = truthy("PALIMPSEST_DISABLE_CHANNEL_DB")
  export const PALIMPSEST_SKIP_MIGRATIONS = truthy("PALIMPSEST_SKIP_MIGRATIONS")

  function number(key: string) {
    const value = process.env[key]
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}

// Dynamic getter for PALIMPSEST_DISABLE_PROJECT_CONFIG
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "PALIMPSEST_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("PALIMPSEST_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for PALIMPSEST_TUI_CONFIG
// This must be evaluated at access time, not module load time,
// because tests and external tooling may set this env var at runtime
Object.defineProperty(Flag, "PALIMPSEST_TUI_CONFIG", {
  get() {
    return process.env["PALIMPSEST_TUI_CONFIG"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for PALIMPSEST_CONFIG_DIR
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "PALIMPSEST_CONFIG_DIR", {
  get() {
    return process.env["PALIMPSEST_CONFIG_DIR"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for PALIMPSEST_CLIENT
// This must be evaluated at access time, not module load time,
// because some commands override the client at runtime
Object.defineProperty(Flag, "PALIMPSEST_CLIENT", {
  get() {
    return process.env["PALIMPSEST_CLIENT"] ?? "cli"
  },
  enumerable: true,
  configurable: false,
})
