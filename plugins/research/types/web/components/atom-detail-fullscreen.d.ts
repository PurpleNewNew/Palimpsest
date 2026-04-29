import { type Component } from "solid-js";
import type { ResearchAtomsListResponse } from "../research-sdk";
type Atom = ResearchAtomsListResponse["atoms"][number];
type Relation = ResearchAtomsListResponse["relations"][number];
type AtomKind = "fact" | "method" | "theorem" | "verification";
/**
 * Plugin-owned research-lens fullscreen overlay. Composes the
 * `<ObjectWorkspaceFullscreen>` primitive (clip-path animation, top bar,
 * 3-pane layout, body lock, Escape, Portal) with the research lens's
 * own slot content (graph, atom detail panel, atom chat, file inspector).
 *
 * Migrated from `apps/web/src/pages/session/atom-detail-fullscreen.tsx`
 * in step 9d.3 of the host-context promotion. The host shell injects
 * its prompt-input component via the `chatInput` slot so the research
 * plugin does not depend on `apps/web` directly.
 */
export declare function AtomDetailFullscreen(props: {
    atoms: Atom[];
    relations: Relation[];
    loading: boolean;
    error: boolean;
    onAtomClick: (atomId: string) => void;
    onAtomCreate: (input: {
        name: string;
        type: AtomKind;
    }) => Promise<Atom>;
    onAtomDelete: (atomId: string) => Promise<void>;
    onRelationCreate: (input: {
        sourceAtomId: string;
        targetAtomId: string;
        relationType: string;
    }) => Promise<void>;
    onRelationUpdate: (input: {
        sourceAtomId: string;
        targetAtomId: string;
        relationType: string;
        nextRelationType: string;
    }) => Promise<void>;
    onRelationDelete: (input: {
        sourceAtomId: string;
        targetAtomId: string;
        relationType: string;
    }) => Promise<void>;
    researchProjectId: string;
    originRect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    visible: boolean;
    focusAtomId?: string | null;
    onClose: () => void;
    /** Host-provided prompt-input component for the inline chat slot. */
    chatInput: Component;
}): import("solid-js").JSX.Element;
export {};
