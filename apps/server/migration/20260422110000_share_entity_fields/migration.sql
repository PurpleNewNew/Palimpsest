-- Add entity-centric share targeting (domain-sharing-model).
-- workspace_share historically carried only project_id + session_id
-- plus a kind discriminator. To share node/run/proposal/decision
-- objects we add a generic entity_kind/entity_id pair. Existing rows
-- keep kind=session with their session_id intact.
ALTER TABLE `workspace_share` ADD COLUMN `entity_kind` text;--> statement-breakpoint
ALTER TABLE `workspace_share` ADD COLUMN `entity_id` text;
