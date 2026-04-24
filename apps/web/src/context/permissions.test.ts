import { describe, expect, test } from "bun:test"
import { PLUGIN_CAPABILITIES_NONE } from "@palimpsest/plugin-sdk/host-web"

import { pluginCapabilities, workspaceCapabilities, workspaceRoleLabel } from "./permissions"

describe("workspace permissions", () => {
  test("maps role labels consistently", () => {
    expect(workspaceRoleLabel("owner")).toBe("owner")
    expect(workspaceRoleLabel("editor")).toBe("editor")
    expect(workspaceRoleLabel("viewer")).toBe("viewer")
    expect(workspaceRoleLabel(undefined)).toBe("guest")
  })

  test("derives owner capabilities", () => {
    expect(workspaceCapabilities("owner")).toEqual({
      role: "owner",
      roleLabel: "owner",
      canWrite: true,
      canReview: true,
      canShare: true,
      canExportImport: true,
      canManageMembers: true,
      canRun: true,
    })
  })

  test("derives editor capabilities", () => {
    expect(workspaceCapabilities("editor")).toEqual({
      role: "editor",
      roleLabel: "editor",
      canWrite: true,
      canReview: true,
      canShare: true,
      canExportImport: true,
      canManageMembers: false,
      canRun: true,
    })
  })

  test("derives viewer capabilities", () => {
    expect(workspaceCapabilities("viewer")).toEqual({
      role: "viewer",
      roleLabel: "viewer",
      canWrite: false,
      canReview: false,
      canShare: false,
      canExportImport: false,
      canManageMembers: false,
      canRun: false,
    })
  })

  test("viewer pluginCapabilities projection matches PLUGIN_CAPABILITIES_NONE", () => {
    const projected = pluginCapabilities(workspaceCapabilities("viewer"))
    expect(projected).toEqual(PLUGIN_CAPABILITIES_NONE)
  })

  test("guest (undefined role) pluginCapabilities projection matches PLUGIN_CAPABILITIES_NONE", () => {
    const projected = pluginCapabilities(workspaceCapabilities(undefined))
    expect(projected).toEqual(PLUGIN_CAPABILITIES_NONE)
  })

  test("pluginCapabilities strips role / roleLabel from the app snapshot", () => {
    const projected = pluginCapabilities(workspaceCapabilities("owner"))
    expect(projected).not.toHaveProperty("role")
    expect(projected).not.toHaveProperty("roleLabel")
  })
})
