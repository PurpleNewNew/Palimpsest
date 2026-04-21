ALTER TABLE `project` ADD `preset_plugin_id` text;--> statement-breakpoint
ALTER TABLE `project` ADD `preset_id` text;--> statement-breakpoint
ALTER TABLE `project` ADD `taxonomy_id` text;--> statement-breakpoint

CREATE TABLE `project_lens` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `project`(`id`) ON DELETE cascade,
  `plugin_id` text NOT NULL,
  `lens_id` text NOT NULL,
  `plugin_version` text,
  `config_version` integer DEFAULT 1 NOT NULL,
  `config` text,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL
);--> statement-breakpoint

CREATE INDEX `project_lens_project_idx` ON `project_lens` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_lens_plugin_idx` ON `project_lens` (`plugin_id`);--> statement-breakpoint
CREATE INDEX `project_lens_lens_idx` ON `project_lens` (`lens_id`);
