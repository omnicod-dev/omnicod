CREATE TABLE IF NOT EXISTS `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`parent_id` text,
	`config` text,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `parts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL REFERENCES `sessions`(`id`) ON DELETE CASCADE,
	`sequence` integer NOT NULL,
	`role` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`tokens` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tool_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`part_id` text NOT NULL REFERENCES `parts`(`id`) ON DELETE CASCADE,
	`tool_name` text NOT NULL,
	`args` text,
	`result` text,
	`duration_ms` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL UNIQUE,
	`command` text NOT NULL,
	`args` text,
	`env` text,
	`enabled` integer DEFAULT true NOT NULL
);
