import { type JSX } from "solid-js";
type View = "graph" | "findings" | "workflows" | "evidence";
export declare function SecurityAuditWorkbench(props: {
    view?: View;
    sessionID?: string;
    class?: string;
}): JSX.Element;
export {};
