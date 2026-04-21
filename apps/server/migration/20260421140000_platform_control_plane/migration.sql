ALTER TABLE `project` ADD `workspace_id` text;--> statement-breakpoint
CREATE INDEX `project_workspace_idx` ON `project` (`workspace_id`);--> statement-breakpoint

CREATE TABLE `account_user` (
  `id` text PRIMARY KEY NOT NULL,
  `username` text NOT NULL,
  `password_hash` text NOT NULL,
  `display_name` text,
  `is_admin` integer DEFAULT false NOT NULL,
  `last_login_at` integer,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `account_user_username_idx` ON `account_user` (`username`);--> statement-breakpoint

CREATE TABLE `account_session` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `expires_at` integer NOT NULL,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `account_user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

CREATE TABLE `account_workspace` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `name` text NOT NULL,
  `owner_user_id` text NOT NULL,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL,
  FOREIGN KEY (`owner_user_id`) REFERENCES `account_user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `account_workspace_slug_idx` ON `account_workspace` (`slug`);--> statement-breakpoint

CREATE TABLE `workspace_membership` (
  `workspace_id` text NOT NULL,
  `user_id` text NOT NULL,
  `role` text NOT NULL,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL,
  PRIMARY KEY(`workspace_id`, `user_id`),
  FOREIGN KEY (`workspace_id`) REFERENCES `account_workspace`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `account_user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

CREATE TABLE `workspace_invite` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `code` text NOT NULL,
  `role` text NOT NULL,
  `invited_by_user_id` text NOT NULL,
  `accepted_by_user_id` text,
  `accepted_at` integer,
  `expires_at` integer,
  `revoked_at` integer,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `account_workspace`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`invited_by_user_id`) REFERENCES `account_user`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`accepted_by_user_id`) REFERENCES `account_user`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invite_code_idx` ON `workspace_invite` (`code`);--> statement-breakpoint

CREATE TABLE `workspace_share` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `project_id` text,
  `session_id` text,
  `slug` text NOT NULL,
  `kind` text NOT NULL,
  `title` text,
  `created_by_user_id` text NOT NULL,
  `revoked_at` integer,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `account_workspace`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `account_user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_share_slug_idx` ON `workspace_share` (`slug`);--> statement-breakpoint

CREATE TABLE `audit_event` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text,
  `project_id` text,
  `actor_user_id` text,
  `action` text NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text NOT NULL,
  `data` text,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `account_workspace`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`actor_user_id`) REFERENCES `account_user`(`id`) ON UPDATE no action ON DELETE set null
);
