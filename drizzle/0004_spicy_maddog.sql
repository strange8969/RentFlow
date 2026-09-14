CREATE TABLE `backup_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`backup_type` text NOT NULL,
	`status` text DEFAULT 'verified' NOT NULL,
	`schema_version` integer NOT NULL,
	`record_count` integer NOT NULL,
	`document_count` integer DEFAULT 0 NOT NULL,
	`checksum` text NOT NULL,
	`object_key` text,
	`verification_json` text DEFAULT '{}' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`verified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_backups_owner_created` ON `backup_snapshots` (`owner_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `bank_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`filename` text NOT NULL,
	`file_hash` text NOT NULL,
	`mapping_json` text NOT NULL,
	`row_count` integer NOT NULL,
	`imported_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_bank_import_hash` ON `bank_imports` (`owner_key`,`file_hash`);--> statement-breakpoint
CREATE TABLE `bank_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`import_id` text NOT NULL,
	`transaction_date` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`direction` text NOT NULL,
	`description` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`fingerprint` text NOT NULL,
	`status` text DEFAULT 'unmatched' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_bank_transaction_fingerprint` ON `bank_transactions` (`owner_key`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `idx_bank_transactions_inbox` ON `bank_transactions` (`owner_key`,`status`,`transaction_date`);--> statement-breakpoint
CREATE TABLE `communication_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenant_id` text NOT NULL,
	`tenancy_id` text,
	`template_kind` text NOT NULL,
	`channel` text NOT NULL,
	`recipient` text NOT NULL,
	`message_snapshot` text NOT NULL,
	`status` text DEFAULT 'prepared' NOT NULL,
	`provider_message_id` text,
	`next_follow_up_date` text,
	`promised_payment_date` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_communication_tenant` ON `communication_events` (`owner_key`,`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `communication_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenant_id` text NOT NULL,
	`channel` text NOT NULL,
	`opted_out` integer DEFAULT 0 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_communication_preference` ON `communication_preferences` (`owner_key`,`tenant_id`,`channel`);--> statement-breakpoint
CREATE TABLE `communication_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_communication_template_kind` ON `communication_templates` (`owner_key`,`kind`);--> statement-breakpoint
CREATE TABLE `inspection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`inspection_id` text NOT NULL,
	`area` text NOT NULL,
	`item_name` text NOT NULL,
	`condition` text NOT NULL,
	`existing_damage` integer DEFAULT 0 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`photo_document_id` text,
	`proposed_deduction_paise` integer DEFAULT 0 NOT NULL,
	`deduction_status` text DEFAULT 'proposed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_inspection_items_inspection` ON `inspection_items` (`owner_key`,`inspection_id`);--> statement-breakpoint
CREATE TABLE `inspections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`property_id` text NOT NULL,
	`room_id` text NOT NULL,
	`tenant_id` text,
	`tenancy_id` text,
	`inspection_type` text NOT NULL,
	`inspection_date` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`meter_number` text DEFAULT '' NOT NULL,
	`meter_reading` real,
	`keys_json` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`acknowledgement_status` text DEFAULT 'pending' NOT NULL,
	`snapshot_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_inspections_room_date` ON `inspections` (`owner_key`,`room_id`,`inspection_date`);--> statement-breakpoint
CREATE TABLE `lease_renewals` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`proposed_rent_paise` integer NOT NULL,
	`proposed_deposit_paise` integer DEFAULT 0 NOT NULL,
	`proposed_start_date` text NOT NULL,
	`proposed_end_date` text,
	`notice_terms` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`tenant_response` text DEFAULT '' NOT NULL,
	`accepted_at` text,
	`approved_at` text,
	`agreement_document_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_renewals_tenancy_status` ON `lease_renewals` (`owner_key`,`tenancy_id`,`status`);--> statement-breakpoint
CREATE TABLE `monthly_closings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`property_id` text,
	`billing_month` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`exception_reason` text DEFAULT '' NOT NULL,
	`snapshot_json` text DEFAULT '{}' NOT NULL,
	`reviewed_at` text,
	`closed_at` text,
	`reopened_at` text,
	`reopened_reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_monthly_closing_scope` ON `monthly_closings` (`owner_key`,`property_id`,`billing_month`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_monthly_closing_all_properties` ON `monthly_closings` (`owner_key`,`billing_month`) WHERE `property_id` IS NULL;--> statement-breakpoint
CREATE INDEX `idx_monthly_closings_owner_month` ON `monthly_closings` (`owner_key`,`billing_month`);--> statement-breakpoint
CREATE TABLE `onboarding_progress` (
	`owner_key` text PRIMARY KEY NOT NULL,
	`current_step` integer DEFAULT 1 NOT NULL,
	`completed_steps_json` text DEFAULT '[]' NOT NULL,
	`dismissed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operation_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`request_key` text NOT NULL,
	`action` text NOT NULL,
	`response_json` text DEFAULT '{}' NOT NULL,
	`completed_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_operation_request` ON `operation_requests` (`owner_key`,`request_key`);--> statement-breakpoint
CREATE INDEX `idx_operation_requests_owner` ON `operation_requests` (`owner_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `payment_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`reference` text NOT NULL,
	`expires_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`upi_uri` text DEFAULT '' NOT NULL,
	`provider` text DEFAULT 'manual_upi' NOT NULL,
	`provider_request_id` text,
	`confirmed_payment_id` text,
	`request_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_payment_request_key` ON `payment_requests` (`owner_key`,`request_key`);--> statement-breakpoint
CREATE INDEX `idx_payment_requests_tenancy` ON `payment_requests` (`owner_key`,`tenancy_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reconciliation_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`bank_transaction_id` text NOT NULL,
	`payment_id` text,
	`expense_id` text,
	`deposit_ledger_id` text,
	`match_type` text NOT NULL,
	`evidence_json` text DEFAULT '{}' NOT NULL,
	`created_payment` integer DEFAULT 0 NOT NULL,
	`reversed_at` text,
	`reversal_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reconciliation_transaction` ON `reconciliation_matches` (`owner_key`,`bank_transaction_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`room_limit` integer NOT NULL,
	`features_json` text DEFAULT '[]' NOT NULL,
	`price_paise` integer,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`accepted_by_user_id` text,
	`accepted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_workspace_invitation_token` ON `workspace_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_workspace_invitations_email` ON `workspace_invitations` (`email`,`status`);--> statement-breakpoint
CREATE TABLE `workspace_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`plan_id` text NOT NULL,
	`status` text DEFAULT 'trial' NOT NULL,
	`trial_ends_at` text,
	`current_period_end` text,
	`provider` text DEFAULT 'test' NOT NULL,
	`provider_customer_id` text,
	`provider_subscription_id` text,
	`grace_ends_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_workspace_subscription` ON `workspace_subscriptions` (`owner_key`);--> statement-breakpoint
DROP INDEX `uq_allocation_payment_charge`;--> statement-breakpoint
CREATE TRIGGER `prevent_payment_overallocation` BEFORE INSERT ON `payment_allocations` WHEN NEW.reversed=0 AND NEW.amount_paise + COALESCE((SELECT SUM(amount_paise) FROM payment_allocations WHERE payment_id=NEW.payment_id AND reversed=0),0) > COALESCE((SELECT amount_paise FROM payments WHERE id=NEW.payment_id AND owner_key=NEW.owner_key AND status='recorded'),-1) BEGIN SELECT RAISE(ABORT, 'Allocation exceeds payment funds'); END;--> statement-breakpoint
ALTER TABLE `move_out_settlements` ADD `refund_paid_paise` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `move_out_settlements` ADD `refund_paid_at` text;
--> statement-breakpoint
PRAGMA optimize;
