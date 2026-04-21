CREATE TABLE `project_taxonomy` (
	`project_id` text PRIMARY KEY NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `node` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`data` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `edge` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`note` text,
	`data` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `node`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `node`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `run` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`node_id` text,
	`session_id` text,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`title` text,
	`triggered_by_actor_id` text,
	`manifest` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`node_id`) REFERENCES `node`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `artifact` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`run_id` text,
	`node_id` text,
	`kind` text NOT NULL,
	`title` text,
	`storage_uri` text,
	`mime_type` text,
	`data` text,
	`provenance` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `run`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`node_id`) REFERENCES `node`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `decision` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`node_id` text,
	`run_id` text,
	`artifact_id` text,
	`kind` text NOT NULL,
	`state` text,
	`rationale` text,
	`decided_by_actor_id` text,
	`superseded_by` text,
	`data` text,
	`refs` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`node_id`) REFERENCES `node`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`run_id`) REFERENCES `run`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`artifact_id`) REFERENCES `artifact`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `node_project_idx` ON `node` (`project_id`);
--> statement-breakpoint
CREATE INDEX `node_kind_idx` ON `node` (`kind`);
--> statement-breakpoint
CREATE INDEX `edge_project_idx` ON `edge` (`project_id`);
--> statement-breakpoint
CREATE INDEX `edge_source_idx` ON `edge` (`source_id`);
--> statement-breakpoint
CREATE INDEX `edge_target_idx` ON `edge` (`target_id`);
--> statement-breakpoint
CREATE INDEX `edge_kind_idx` ON `edge` (`kind`);
--> statement-breakpoint
CREATE INDEX `run_project_idx` ON `run` (`project_id`);
--> statement-breakpoint
CREATE INDEX `run_node_idx` ON `run` (`node_id`);
--> statement-breakpoint
CREATE INDEX `run_session_idx` ON `run` (`session_id`);
--> statement-breakpoint
CREATE INDEX `run_kind_idx` ON `run` (`kind`);
--> statement-breakpoint
CREATE INDEX `run_status_idx` ON `run` (`status`);
--> statement-breakpoint
CREATE INDEX `artifact_project_idx` ON `artifact` (`project_id`);
--> statement-breakpoint
CREATE INDEX `artifact_run_idx` ON `artifact` (`run_id`);
--> statement-breakpoint
CREATE INDEX `artifact_node_idx` ON `artifact` (`node_id`);
--> statement-breakpoint
CREATE INDEX `artifact_kind_idx` ON `artifact` (`kind`);
--> statement-breakpoint
CREATE INDEX `decision_project_idx` ON `decision` (`project_id`);
--> statement-breakpoint
CREATE INDEX `decision_node_idx` ON `decision` (`node_id`);
--> statement-breakpoint
CREATE INDEX `decision_run_idx` ON `decision` (`run_id`);
--> statement-breakpoint
CREATE INDEX `decision_artifact_idx` ON `decision` (`artifact_id`);
--> statement-breakpoint
CREATE INDEX `decision_kind_idx` ON `decision` (`kind`);
--> statement-breakpoint
CREATE INDEX `decision_state_idx` ON `decision` (`state`);
--> statement-breakpoint
CREATE TABLE `proposal` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text,
	`status` text NOT NULL,
	`proposed_by_actor_type` text NOT NULL,
	`proposed_by_actor_id` text NOT NULL,
	`proposed_by_actor_version` text,
	`changes` text NOT NULL,
	`rationale` text,
	`refs` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `review` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`reviewer_actor_type` text NOT NULL,
	`reviewer_actor_id` text NOT NULL,
	`reviewer_actor_version` text,
	`verdict` text NOT NULL,
	`comments` text,
	`refs` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposal`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `domain_commit` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`proposal_id` text,
	`review_id` text,
	`committed_by_actor_type` text NOT NULL,
	`committed_by_actor_id` text NOT NULL,
	`committed_by_actor_version` text,
	`applied_changes` text NOT NULL,
	`refs` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposal`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`review_id`) REFERENCES `review`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `proposal_project_idx` ON `proposal` (`project_id`);
--> statement-breakpoint
CREATE INDEX `proposal_status_idx` ON `proposal` (`status`);
--> statement-breakpoint
CREATE INDEX `review_project_idx` ON `review` (`project_id`);
--> statement-breakpoint
CREATE INDEX `review_proposal_idx` ON `review` (`proposal_id`);
--> statement-breakpoint
CREATE INDEX `review_verdict_idx` ON `review` (`verdict`);
--> statement-breakpoint
CREATE INDEX `domain_commit_project_idx` ON `domain_commit` (`project_id`);
--> statement-breakpoint
CREATE INDEX `domain_commit_proposal_idx` ON `domain_commit` (`proposal_id`);
--> statement-breakpoint
CREATE INDEX `domain_commit_review_idx` ON `domain_commit` (`review_id`);
