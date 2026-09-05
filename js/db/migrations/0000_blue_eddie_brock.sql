CREATE TABLE `accounts` (
	`username` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `client_users` (
	`client_name` text NOT NULL,
	`username` text NOT NULL,
	PRIMARY KEY(`client_name`, `username`),
	FOREIGN KEY (`client_name`) REFERENCES `clients`(`name`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`username`) REFERENCES `accounts`(`username`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`name` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'mirror' NOT NULL,
	`user_switch_mode` text DEFAULT 'SAVE' NOT NULL,
	`default_modules` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'offline' NOT NULL,
	`current_user` text DEFAULT 'default' NOT NULL,
	`last_online` integer,
	`connected_at` integer,
	`connections` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`username`) REFERENCES `accounts`(`username`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_configs` (
	`username` text NOT NULL,
	`client_name` text DEFAULT '' NOT NULL,
	`modules` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`username`, `client_name`),
	FOREIGN KEY (`username`) REFERENCES `accounts`(`username`) ON UPDATE no action ON DELETE cascade
);
