-- De-ML research schema (Step 11 phases B2 + B3b).
-- Drops the atom_evidence_type column on the atom table and the 6 ML
-- tables (experiment, experiment_watch, experiment_execution_watch,
-- remote_task, remote_server, code) plus their indexes.
-- The drizzle snapshot was stale and also produced CREATE TABLE
-- statements for tables already shipped by earlier hand-written
-- migrations (account_*, workspace_*, audit_event, project_lens,
-- session_attachment) plus four ALTER TABLE project ADD column
-- statements for columns already added; those have been removed
-- because re-running them errors with `table already exists`.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_atom` (
	`atom_id` text PRIMARY KEY,
	`research_project_id` text NOT NULL,
	`atom_name` text NOT NULL,
	`atom_type` text NOT NULL,
	`atom_claim_path` text,
	`atom_evidence_status` text DEFAULT 'pending' NOT NULL,
	`atom_evidence_path` text,
	`atom_evidence_assessment_path` text,
	`article_id` text,
	`session_id` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_atom_research_project_id_research_project_research_project_id_fk` FOREIGN KEY (`research_project_id`) REFERENCES `research_project`(`research_project_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_atom_article_id_article_article_id_fk` FOREIGN KEY (`article_id`) REFERENCES `article`(`article_id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_atom`(`atom_id`, `research_project_id`, `atom_name`, `atom_type`, `atom_claim_path`, `atom_evidence_status`, `atom_evidence_path`, `atom_evidence_assessment_path`, `article_id`, `session_id`, `time_created`, `time_updated`) SELECT `atom_id`, `research_project_id`, `atom_name`, `atom_type`, `atom_claim_path`, `atom_evidence_status`, `atom_evidence_path`, `atom_evidence_assessment_path`, `article_id`, `session_id`, `time_created`, `time_updated` FROM `atom`;--> statement-breakpoint
DROP TABLE `atom`;--> statement-breakpoint
ALTER TABLE `__new_atom` RENAME TO `atom`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `code_research_project_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `code_article_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `experiment_execution_watch_exp_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `experiment_execution_watch_status_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `experiment_research_project_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `experiment_session_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `experiment_atom_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `experiment_watch_exp_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `experiment_watch_status_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `remote_task_exp_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `remote_task_status_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `remote_task_exp_kind_resource_idx`;--> statement-breakpoint
CREATE INDEX `atom_research_project_idx` ON `atom` (`research_project_id`);--> statement-breakpoint
CREATE INDEX `atom_session_idx` ON `atom` (`session_id`);--> statement-breakpoint
DROP TABLE `code`;--> statement-breakpoint
DROP TABLE `experiment_execution_watch`;--> statement-breakpoint
DROP TABLE `experiment`;--> statement-breakpoint
DROP TABLE `experiment_watch`;--> statement-breakpoint
DROP TABLE `remote_task`;--> statement-breakpoint
DROP TABLE `remote_server`;
