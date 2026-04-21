ALTER TABLE `run` ADD `triggered_by_actor_type` text;
--> statement-breakpoint
ALTER TABLE `run` ADD `triggered_by_actor_version` text;
--> statement-breakpoint
ALTER TABLE `decision` ADD `decided_by_actor_type` text;
--> statement-breakpoint
ALTER TABLE `decision` ADD `decided_by_actor_version` text;
