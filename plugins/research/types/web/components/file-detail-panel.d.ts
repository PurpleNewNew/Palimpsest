/**
 * Plugin-owned file viewer overlay used by the research workbench
 * fullscreen layout. Migrated from
 * `apps/web/src/pages/session/file-detail-panel.tsx` in step 9d.3 of
 * the host-context promotion. Host context is reached only via
 * `PluginWebHost.file()` and `PluginWebHost.sdk().event`.
 */
export declare function FileDetailPanel(props: {
    path: string;
    title: string;
    onClose: () => void;
    leftOffset?: number;
}): import("solid-js").JSX.Element;
