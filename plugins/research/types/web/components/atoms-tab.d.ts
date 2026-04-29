import { type Component } from "solid-js";
/**
 * Plugin-owned research-lens atoms session tab. Migrated from
 * `apps/web/src/pages/session/atoms-tab.tsx` in step 9d.3 of the
 * host-context promotion. The host shell injects its prompt-input
 * component via `chatInput` so the inline atom chat can be rendered
 * without the plugin importing apps/web composer slots directly.
 */
export declare function AtomsTab(props: {
    researchProjectId: string;
    currentSessionId?: string;
    /** Host-provided prompt-input component for the inline atom chat slot. */
    chatInput: Component;
}): import("solid-js").JSX.Element;
