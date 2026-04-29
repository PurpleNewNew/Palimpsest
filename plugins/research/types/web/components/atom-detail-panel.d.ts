import { type ResearchAtomsListResponse } from "../research-sdk";
type Atom = ResearchAtomsListResponse["atoms"][number];
/**
 * Plugin-owned right panel that displays a single atom's claim,
 * evidence, and assessment, plus controls to edit status, navigate to
 * the atom session, and toggle inline chat. Migrated from
 * `apps/web/src/pages/session/atom-detail-panel.tsx` in step 9d.3 of
 * the host-context promotion. Host context flows through
 * `PluginWebHost` (file slice + SDK event bus + sdk slice for the
 * directory used in session links) and the plugin's own
 * `useResearchSDK` for research-specific endpoints.
 */
export declare function AtomDetailPanel(props: {
    atom: Atom;
    onClose: () => void;
    onDelete?: (atomId: string) => Promise<void>;
    onAtomSessionId?: (sessionId: string | null) => void;
    chatOpen?: boolean;
    onToggleChat?: () => void;
    onOpenFileDetail?: (path: string, title: string) => void;
}): import("solid-js").JSX.Element;
export {};
