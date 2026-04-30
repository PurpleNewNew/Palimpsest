import { Log } from "./log"

// Node/Bun expose these private accessors at runtime but neither runtime
// publishes them in @types. We do a single typed coercion instead of
// scattering `as any` across every call site.
const proc = process as unknown as {
  _getActiveHandles(): unknown[]
  _getActiveRequests(): unknown[]
}

export namespace EventLoop {
  export async function wait() {
    return new Promise<void>((resolve) => {
      const check = () => {
        const handles = proc._getActiveHandles()
        const requests = proc._getActiveRequests()
        Log.Default.info("eventloop", { active: [...handles, ...requests] })
        if (handles.length === 0 && requests.length === 0) {
          resolve()
        } else {
          setImmediate(check)
        }
      }
      check()
    })
  }
}
