import "solid-js"

interface ImportMetaEnv {
  readonly VITE_PALIMPSEST_SERVER_HOST: string
  readonly VITE_PALIMPSEST_SERVER_PORT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "solid-js" {
  namespace JSX {
    interface Directives {
      sortable: true
    }
  }
}
