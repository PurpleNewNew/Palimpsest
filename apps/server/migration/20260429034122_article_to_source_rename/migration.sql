CREATE TABLE `source` (
	`source_id` text PRIMARY KEY,
	`research_project_id` text NOT NULL,
	`path` text NOT NULL,
	`title` text,
	`source_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_source_research_project_id_research_project_research_project_id_fk` FOREIGN KEY (`research_project_id`) REFERENCES `research_project`(`research_project_id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `atom` ADD `source_id` text REFERENCES source(source_id);--> statement-breakpoint
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
	`source_id` text,
	`session_id` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_atom_research_project_id_research_project_research_project_id_fk` FOREIGN KEY (`research_project_id`) REFERENCES `research_project`(`research_project_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_atom_source_id_source_source_id_fk` FOREIGN KEY (`source_id`) REFERENCES `source`(`source_id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_atom`(`atom_id`, `research_project_id`, `atom_name`, `atom_type`, `atom_claim_path`, `atom_evidence_status`, `atom_evidence_path`, `atom_evidence_assessment_path`, `session_id`, `time_created`, `time_updated`) SELECT `atom_id`, `research_project_id`, `atom_name`, `atom_type`, `atom_claim_path`, `atom_evidence_status`, `atom_evidence_path`, `atom_evidence_assessment_path`, `session_id`, `time_created`, `time_updated` FROM `atom`;--> statement-breakpoint
DROP TABLE `atom`;--> statement-breakpoint
ALTER TABLE `__new_atom` RENAME TO `atom`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `article_research_project_idx`;--> statement-breakpoint
CREATE INDEX `atom_research_project_idx` ON `atom` (`research_project_id`);--> statement-breakpoint
CREATE INDEX `atom_session_idx` ON `atom` (`session_id`);--> statement-breakpoint
CREATE INDEX `source_research_project_idx` ON `source` (`research_project_id`);--> statement-breakpoint
DROP TABLE `article`;