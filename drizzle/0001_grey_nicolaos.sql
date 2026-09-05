CREATE TABLE `driver_days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`gross_earnings` real NOT NULL,
	`rides` integer DEFAULT 0 NOT NULL,
	`hours_worked` real DEFAULT 0 NOT NULL,
	`kilometers` real DEFAULT 0 NOT NULL,
	`fuel_cost` real DEFAULT 0 NOT NULL,
	`maintenance_cost` real DEFAULT 0 NOT NULL,
	`other_cost` real DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_driver_days_user_date` ON `driver_days` (`user_id`,`date`);