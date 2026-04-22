CREATE TABLE `workspace_review_queue` (
  `proposal_id` text PRIMARY KEY NOT NULL REFERENCES `proposal`(`id`) ON DELETE cascade,
  `workspace_id` text NOT NULL REFERENCES `account_workspace`(`id`) ON DELETE cascade,
  `project_id` text NOT NULL REFERENCES `project`(`id`) ON DELETE cascade,
  `assignee_user_id` text REFERENCES `account_user`(`id`) ON DELETE set null,
  `assigned_by_user_id` text REFERENCES `account_user`(`id`) ON DELETE set null,
  `priority` text NOT NULL DEFAULT 'normal',
  `due_at` integer,
  `sla_hours` integer,
  `time_created` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `time_updated` integer NOT NULL DEFAULT (unixepoch() * 1000)
);--> statement-breakpoint
CREATE INDEX `workspace_review_queue_workspace_project_idx` ON `workspace_review_queue` (`workspace_id`,`project_id`);
