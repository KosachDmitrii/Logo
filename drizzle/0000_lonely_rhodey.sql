CREATE TABLE `logo_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_email` text NOT NULL,
	`direction_key` text NOT NULL,
	`direction_title` text NOT NULL,
	`prompt` text NOT NULL,
	`object_key` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `logo_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `logo_generations_project_idx` ON `logo_generations` (`project_id`);--> statement-breakpoint
CREATE INDEX `logo_generations_user_idx` ON `logo_generations` (`user_email`);--> statement-breakpoint
CREATE TABLE `logo_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`brand_name` text NOT NULL,
	`brief_json` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`selected_generation_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `logo_projects_user_created_idx` ON `logo_projects` (`user_email`,`created_at`);