CREATE TABLE `article` (
	`article_id` text PRIMARY KEY,
	`research_project_id` text NOT NULL,
	`path` text NOT NULL,
	`code_path` text,
	`title` text,
	`source_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_article_research_project_id_research_project_research_project_id_fk` FOREIGN KEY (`research_project_id`) REFERENCES `research_project`(`research_project_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `atom_relation` (
	`atom_id_source` text NOT NULL,
	`atom_id_target` text NOT NULL,
	`relation_type` text NOT NULL,
	`note` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `atom_relation_pk` PRIMARY KEY(`atom_id_source`, `atom_id_target`, `relation_type`),
	CONSTRAINT `fk_atom_relation_atom_id_source_atom_atom_id_fk` FOREIGN KEY (`atom_id_source`) REFERENCES `atom`(`atom_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_atom_relation_atom_id_target_atom_atom_id_fk` FOREIGN KEY (`atom_id_target`) REFERENCES `atom`(`atom_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `atom` (
	`atom_id` text PRIMARY KEY,
	`research_project_id` text NOT NULL,
	`atom_name` text NOT NULL,
	`atom_type` text NOT NULL,
	`atom_content_path` text,
	`atom_proof_type` text NOT NULL,
	`atom_proof_plan_path` text,
	`atom_proof_status` text DEFAULT 'pending' NOT NULL,
	`atom_proof_result_path` text,
	`article_id` text,
	`exp_id` text,
	`session_id` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_atom_research_project_id_research_project_research_project_id_fk` FOREIGN KEY (`research_project_id`) REFERENCES `research_project`(`research_project_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_atom_article_id_article_article_id_fk` FOREIGN KEY (`article_id`) REFERENCES `article`(`article_id`) ON DELETE SET NULL,
	CONSTRAINT `fk_atom_exp_id_experiment_exp_id_fk` FOREIGN KEY (`exp_id`) REFERENCES `experiment`(`exp_id`) ON DELETE SET NULL,
	CONSTRAINT `fk_atom_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `experiment` (
	`exp_id` text PRIMARY KEY,
	`code_info` text,
	`result` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `research_project` (
	`research_project_id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`background_path` text,
	`goal_path` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_research_project_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `article_research_project_idx` ON `article` (`research_project_id`);--> statement-breakpoint
CREATE INDEX `atom_relation_target_idx` ON `atom_relation` (`atom_id_target`);--> statement-breakpoint
CREATE INDEX `atom_research_project_idx` ON `atom` (`research_project_id`);--> statement-breakpoint
CREATE INDEX `atom_exp_idx` ON `atom` (`exp_id`);--> statement-breakpoint
CREATE INDEX `atom_session_idx` ON `atom` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `research_project_project_idx` ON `research_project` (`project_id`);