import { Context } from "../util/context"

interface Context {
  workspaceID?: string
  routeWorkspaceID?: string
}

const context = Context.create<Context>("workspace")

export const WorkspaceContext = {
  async provide<R>(input: { workspaceID?: string; routeWorkspaceID?: string; fn: () => R }): Promise<R> {
    return context.provide({ workspaceID: input.workspaceID, routeWorkspaceID: input.routeWorkspaceID }, async () => {
      return input.fn()
    })
  },

  get workspaceID() {
    try {
      return context.use().workspaceID
    } catch (e) {
      return undefined
    }
  },

  get routeWorkspaceID() {
    try {
      return context.use().routeWorkspaceID
    } catch (e) {
      return undefined
    }
  },
}
