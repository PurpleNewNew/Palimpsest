export type SecurityActor = {
    type: "user" | "agent" | "system";
    id: string;
    version?: string;
};
export type SecurityProposalSummary = {
    id: string;
    title?: string;
    rationale?: string;
    status?: string;
    revision?: number;
    actor?: SecurityActor;
    refs?: Record<string, unknown>;
    time?: {
        created: number;
        updated: number;
    };
};
export type SecurityNode = {
    id: string;
    kind: string;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
    time: {
        created: number;
        updated: number;
    };
};
export type SecurityEdge = {
    id?: string;
    kind: string;
    sourceID: string;
    targetID: string;
    note?: string;
};
export type SecurityFindingCard = SecurityNode & {
    findingKind?: SecurityFindingKind;
    evidenceCount?: number;
    relatedDecisionKinds?: string[];
    links?: SecurityEdge[];
};
export type SecurityRun = {
    id: string;
    kind: string;
    status: string;
    title?: string;
    nodeID?: string;
    sessionID?: string;
    manifest?: Record<string, unknown>;
    startedAt?: number;
    finishedAt?: number;
    time: {
        created: number;
        updated: number;
    };
};
export type SecurityArtifact = {
    id: string;
    kind: string;
    title?: string;
    nodeID?: string;
    runID?: string;
    mimeType?: string;
    data?: Record<string, unknown>;
    time: {
        created: number;
        updated: number;
    };
};
export type SecurityDecision = {
    id: string;
    kind: string;
    state?: string;
    rationale?: string;
    nodeID?: string;
    runID?: string;
    artifactID?: string;
    data?: Record<string, unknown>;
    refs?: Record<string, unknown>;
    time: {
        created: number;
        updated: number;
    };
};
export type SecurityOverview = {
    pluginID: string;
    projectID?: string;
    scope?: {
        target: string;
        objective: string;
        constraints: string;
    };
    summary?: Record<string, number>;
    nodeCounts?: Record<string, number>;
    runCounts?: Record<string, number>;
    decisionCounts?: Record<string, number>;
    pendingProposals: SecurityProposalSummary[];
    recentCommits: Array<{
        id: string;
        proposalID?: string;
        changeCount?: number;
        time: {
            created: number;
        };
    }>;
};
export type SecurityGraph = {
    pluginID: string;
    projectID?: string;
    scope?: {
        target: string;
        objective: string;
        constraints: string;
    };
    nodes: Array<SecurityNode & {
        findingKind?: SecurityFindingKind;
    }>;
    edges: SecurityEdge[];
    runs: SecurityRun[];
    artifacts: SecurityArtifact[];
    decisions: SecurityDecision[];
    pendingProposals: SecurityProposalSummary[];
};
export type SecurityFindings = {
    findings: SecurityFindingCard[];
    risks: SecurityNode[];
    surfaces: SecurityNode[];
    controls: SecurityNode[];
    pendingProposals: SecurityProposalSummary[];
};
export type SecuritySeverity = "low" | "medium" | "high" | "critical";
export type SecurityConfidence = "low" | "medium" | "high";
export type SecurityValidationOutcome = "supports" | "contradicts" | "needs_validation";
export type SecurityRiskKind = "accept_risk" | "mitigate_risk" | "false_positive" | "needs_validation" | "defer_risk";
export type SecurityRiskState = "accepted" | "rejected" | "pending";
export type SecurityFindingKind = "ssrf" | "auth_bypass" | "deserialization" | "rce" | "generic";
/**
 * Plugin-owned security audit client. Receives every host dependency it
 * needs through the plugin web host bridge and does not reach into the
 * host app directly. The optional `getDirectory` argument remains for
 * route-driven overrides (e.g. share pages), but defaults to the host's
 * current directory.
 */
export declare function useSecurityAudit(getDirectory?: () => string | undefined): {
    actor: () => SecurityActor;
    status(): Promise<{
        pluginID: string;
        prompts: string[];
        workflows: string[];
    }>;
    overview(): Promise<SecurityOverview>;
    graph(): Promise<SecurityGraph>;
    findings(): Promise<SecurityFindings>;
    nodeSession(input: {
        nodeID: string;
        parentID?: string;
    }): Promise<{
        id: string;
        projectID: string;
        parentID?: string;
    }>;
    bootstrap(input?: {
        target?: string;
        objective?: string;
        constraints?: string;
        sessionID?: string;
    }): Promise<SecurityProposalSummary>;
    hypothesize(input: {
        title: string;
        description: string;
        evidence?: string;
        findingKind?: SecurityFindingKind;
        severity?: SecuritySeverity;
        confidence?: SecurityConfidence;
        targetID?: string;
        surfaceID?: string;
        riskTitle?: string;
        sessionID?: string;
    }): Promise<SecurityProposalSummary>;
    validate(input: {
        findingID: string;
        summary: string;
        evidence?: string;
        outcome?: SecurityValidationOutcome;
        sessionID?: string;
    }): Promise<SecurityProposalSummary>;
    riskDecision(input: {
        nodeID: string;
        kind: SecurityRiskKind;
        state?: SecurityRiskState;
        rationale: string;
        evidence?: string;
        sessionID?: string;
    }): Promise<SecurityProposalSummary>;
    review(input: {
        proposalID: string;
        verdict: "approve" | "reject" | "request_changes";
        comments?: string;
        actor?: SecurityActor;
    }): Promise<{
        proposal: SecurityProposalSummary;
        commit?: {
            id: string;
        };
    }>;
};
