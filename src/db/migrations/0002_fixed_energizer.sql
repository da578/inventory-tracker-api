CREATE TABLE `categories` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` varchar(36) NOT NULL,
	`name` varchar(150) NOT NULL,
	`contact_email` varchar(255),
	`contact_phone` varchar(50),
	`address` text,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
INSERT INTO `categories` (`id`, `name`, `description`, `created_at`, `updated_at`)
VALUES ('cat-default-0000-0000-000000000001', 'General', 'Default category', NOW(), NOW());
--> statement-breakpoint
INSERT INTO `suppliers` (`id`, `name`, `contact_email`, `contact_phone`, `address`, `created_at`, `updated_at`)
VALUES ('sup-default-0000-0000-000000000001', 'Default Supplier', 'supplier@example.com', '08123456789', 'Central Warehouse', NOW(), NOW());
--> statement-breakpoint
ALTER TABLE `products` ADD `category_id` varchar(36) NOT NULL DEFAULT 'cat-default-0000-0000-000000000001';
--> statement-breakpoint
ALTER TABLE `products` ADD `supplier_id` varchar(36) NOT NULL DEFAULT 'sup-default-0000-0000-000000000001';
--> statement-breakpoint
ALTER TABLE `products` ALTER COLUMN `category_id` DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE `products` ALTER COLUMN `supplier_id` DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE restrict ON UPDATE no action;
