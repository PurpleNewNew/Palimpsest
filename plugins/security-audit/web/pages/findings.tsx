import type { JSX } from "solid-js"

import { SecurityAuditWorkbench } from "../components/workbench"

export default function Findings(): JSX.Element {
  return <SecurityAuditWorkbench view="findings" class="h-full" />
}
