CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`summary` text NOT NULL,
	`actor_context` text DEFAULT 'owner' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_owner_created` ON `audit_log` (`owner_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `deposit_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`date` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`related_charge_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_deposit_tenancy_date` ON `deposit_ledger` (`tenancy_id`,`date`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenant_id` text,
	`tenancy_id` text,
	`room_id` text,
	`type` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`object_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_documents_object_key` ON `documents` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_documents_owner_created` ON `documents` (`owner_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `electricity_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`reading_id` text NOT NULL,
	`billing_month` text NOT NULL,
	`units` real NOT NULL,
	`rate_paise_per_unit` integer NOT NULL,
	`energy_charge_paise` integer NOT NULL,
	`fixed_charge_paise` integer DEFAULT 0 NOT NULL,
	`adjustment_paise` integer DEFAULT 0 NOT NULL,
	`total_paise` integer NOT NULL,
	`due_date` text,
	`bill_number` text,
	`reversed` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_electricity_bill_tenancy_month` ON `electricity_bills` (`tenancy_id`,`billing_month`);--> statement-breakpoint
CREATE INDEX `idx_electricity_bills_owner_month` ON `electricity_bills` (`owner_key`,`billing_month`);--> statement-breakpoint
CREATE TABLE `electricity_rate_history` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`rate_paise_per_unit` integer NOT NULL,
	`fixed_charge_paise` integer DEFAULT 0 NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`tariff_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_electricity_rate_effective` ON `electricity_rate_history` (`tenancy_id`,`effective_from`);--> statement-breakpoint
CREATE INDEX `idx_electricity_rates_tenancy` ON `electricity_rate_history` (`tenancy_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `electricity_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`billing_month` text NOT NULL,
	`previous_reading` real NOT NULL,
	`current_reading` real NOT NULL,
	`units` real NOT NULL,
	`reading_date` text NOT NULL,
	`meter_number_snapshot` text DEFAULT '' NOT NULL,
	`photo_document_id` text,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reading_tenancy_month` ON `electricity_readings` (`tenancy_id`,`billing_month`);--> statement-breakpoint
CREATE INDEX `idx_readings_owner_month` ON `electricity_readings` (`owner_key`,`billing_month`);--> statement-breakpoint
CREATE TABLE `other_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`charge_date` text NOT NULL,
	`charge_type` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`description` text NOT NULL,
	`document_id` text,
	`reversed` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_other_charges_tenancy_date` ON `other_charges` (`tenancy_id`,`charge_date`);--> statement-breakpoint
CREATE TABLE `payment_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`payment_id` text NOT NULL,
	`charge_type` text NOT NULL,
	`charge_id` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`reversed` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_allocations_payment` ON `payment_allocations` (`payment_id`);--> statement-breakpoint
CREATE INDEX `idx_allocations_charge` ON `payment_allocations` (`charge_type`,`charge_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`payment_date` text NOT NULL,
	`mode` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`proof_document_id` text,
	`status` text DEFAULT 'recorded' NOT NULL,
	`reversed_at` text,
	`reversal_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_payments_owner_date` ON `payments` (`owner_key`,`payment_date`);--> statement-breakpoint
CREATE INDEX `idx_payments_tenancy` ON `payments` (`tenancy_id`);--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`default_rent_due_day` integer DEFAULT 10 NOT NULL,
	`default_electricity_rate_paise` integer DEFAULT 0 NOT NULL,
	`default_electricity_fixed_charge_paise` integer DEFAULT 0 NOT NULL,
	`default_late_fee_mode` text DEFAULT 'none' NOT NULL,
	`default_late_fee_value` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_properties_owner_active` ON `properties` (`owner_key`,`active`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`receipt_number` text NOT NULL,
	`payment_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`status` text DEFAULT 'issued' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_receipt_number_owner` ON `receipts` (`owner_key`,`receipt_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_receipt_payment` ON `receipts` (`payment_id`);--> statement-breakpoint
CREATE TABLE `rent_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`billing_month` text NOT NULL,
	`period_start` text,
	`period_end` text,
	`amount_paise` integer NOT NULL,
	`due_date` text NOT NULL,
	`source` text DEFAULT 'generated' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`reversed` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_rent_charge_month_source` ON `rent_charges` (`tenancy_id`,`billing_month`,`source`);--> statement-breakpoint
CREATE INDEX `idx_rent_charges_owner_month` ON `rent_charges` (`owner_key`,`billing_month`);--> statement-breakpoint
CREATE TABLE `rent_rate_history` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_rent_rate_effective` ON `rent_rate_history` (`tenancy_id`,`effective_from`);--> statement-breakpoint
CREATE INDEX `idx_rent_rates_tenancy` ON `rent_rate_history` (`tenancy_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`property_id` text NOT NULL,
	`room_number` text NOT NULL,
	`normalized_room_number` text NOT NULL,
	`floor` text DEFAULT '' NOT NULL,
	`meter_number` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'vacant' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_rooms_property_number` ON `rooms` (`owner_key`,`property_id`,`normalized_room_number`);--> statement-breakpoint
CREATE INDEX `idx_rooms_owner_property` ON `rooms` (`owner_key`,`property_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`owner_key` text PRIMARY KEY NOT NULL,
	`landlord_name` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`timezone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`date_format` text DEFAULT 'dd MMM yyyy' NOT NULL,
	`bill_prefix` text DEFAULT 'RF-BILL' NOT NULL,
	`receipt_prefix` text DEFAULT 'RF-RCPT' NOT NULL,
	`default_rent_due_day` integer DEFAULT 10 NOT NULL,
	`upi_id` text DEFAULT '' NOT NULL,
	`payment_instructions` text DEFAULT '' NOT NULL,
	`bill_footer` text DEFAULT '' NOT NULL,
	`default_electricity_rate_paise` integer DEFAULT 0 NOT NULL,
	`default_electricity_fixed_charge_paise` integer DEFAULT 0 NOT NULL,
	`max_file_size_mb` integer DEFAULT 20 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tenancies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`property_id` text NOT NULL,
	`room_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`move_in_date` text NOT NULL,
	`rent_start_date` text NOT NULL,
	`move_out_date` text,
	`notice_date` text,
	`rent_due_day` integer NOT NULL,
	`security_deposit_required_paise` integer DEFAULT 0 NOT NULL,
	`opening_balance_paise` integer DEFAULT 0 NOT NULL,
	`initial_meter_reading` real,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tenancies_owner_status` ON `tenancies` (`owner_key`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tenancies_room_status` ON `tenancies` (`room_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tenancies_tenant` ON `tenancies` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`full_name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`alternate_phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`id_type` text DEFAULT '' NOT NULL,
	`id_number_masked` text DEFAULT '' NOT NULL,
	`permanent_address` text DEFAULT '' NOT NULL,
	`emergency_contact_name` text DEFAULT '' NOT NULL,
	`emergency_contact_phone` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tenants_owner_name` ON `tenants` (`owner_key`,`full_name`);