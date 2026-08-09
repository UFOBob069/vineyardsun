CREATE TABLE `product_visibility` (
	`handle` text PRIMARY KEY NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
