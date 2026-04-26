import { type NodeProps } from "@dschz/solid-flow";
export type AtomNodeData = {
    label: string;
    atomType: string;
    evidenceStatus: string;
    evidenceType: string;
};
export declare function AtomNode(props: NodeProps<AtomNodeData, "atom">): import("solid-js").JSX.Element;
