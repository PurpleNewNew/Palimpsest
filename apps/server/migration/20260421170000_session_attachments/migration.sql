CREATE TABLE `session_attachment` (
  `session_id` text NOT NULL,
  `entity` text NOT NULL,
  `entity_id` text NOT NULL,
  `title` text,
  `lens_id` text,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL,
  PRIMARY KEY(`session_id`, `entity`, `entity_id`),
  FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `session_attachment_session_idx` ON `session_attachment` (`session_id`);
CREATE INDEX `session_attachment_entity_idx` ON `session_attachment` (`entity`, `entity_id`);
