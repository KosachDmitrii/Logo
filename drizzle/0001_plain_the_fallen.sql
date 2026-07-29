CREATE TABLE `logo_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_email` text NOT NULL,
	`parent_id` text NOT NULL,
	`stage` text NOT NULL,
	`label` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`prompt` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `logo_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `logo_assets_project_stage_idx` ON `logo_assets` (`project_id`,`stage`);--> statement-breakpoint
CREATE INDEX `logo_assets_user_idx` ON `logo_assets` (`user_email`);