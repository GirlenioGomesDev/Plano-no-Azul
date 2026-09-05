CREATE TABLE `card_purchases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`card_id` integer NOT NULL,
	`description` text NOT NULL,
	`total_amount` real NOT NULL,
	`installments` integer DEFAULT 1 NOT NULL,
	`purchase_date` text NOT NULL,
	`category` text DEFAULT 'Outros' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `credit_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_purchases_user_card` ON `card_purchases` (`user_id`,`card_id`);--> statement-breakpoint
CREATE TABLE `credit_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`last_four` text DEFAULT '0000' NOT NULL,
	`color` text DEFAULT 'blue' NOT NULL,
	`credit_limit` real NOT NULL,
	`closing_day` integer DEFAULT 1 NOT NULL,
	`due_day` integer DEFAULT 10 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_credit_cards_user` ON `credit_cards` (`user_id`);--> statement-breakpoint
ALTER TABLE `driver_days` ADD `odometer_start` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_days` ADD `odometer_end` real DEFAULT 0 NOT NULL;