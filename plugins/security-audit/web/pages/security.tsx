import type { JSX } from "solid-js"

import { SecurityAuditWorkbench } from "../components/workbench"

export default function Security(): JSX.Element {
  return <SecurityAuditWorkbench view="graph" class="h-full" />
}
