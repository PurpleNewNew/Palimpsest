import { describe, expect, test } from "bun:test"

import { workspaceCapabilities, workspaceRoleLabel } from "./permissions"

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
    })
  })
})
