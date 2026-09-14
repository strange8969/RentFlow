CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`property_id` text NOT NULL,
	`room_id` text,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`incurred_date` text NOT NULL,
	`paid_date` text,
	`payee` text DEFAULT '' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`document_id` text,
	`recurring_template_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_owner_date` ON `expenses` (`owner_key`,`incurred_date`);--> statement-breakpoint
CREATE INDEX `idx_expenses_property` ON `expenses` (`property_id`,`incurred_date`);--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenant_id` text NOT NULL,
	`tenancy_id` text,
	`note` text NOT NULL,
	`next_follow_up_date` text,
	`promised_payment_date` text,
	`status` text DEFAULT 'open' NOT NULL,
	`reminder_draft` text DEFAULT '' NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_followups_owner_date` ON `follow_ups` (`owner_key`,`status`,`next_follow_up_date`);--> statement-breakpoint
CREATE INDEX `idx_followups_tenant` ON `follow_ups` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `maintenance_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`property_id` text NOT NULL,
	`room_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`reported_date` text NOT NULL,
	`due_date` text,
	`completed_date` text,
	`assigned_to` text DEFAULT '' NOT NULL,
	`estimated_cost_paise` integer DEFAULT 0 NOT NULL,
	`actual_cost_paise` integer DEFAULT 0 NOT NULL,
	`expense_id` text,
	`document_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_maintenance_owner_status` ON `maintenance_issues` (`owner_key`,`status`,`due_date`);--> statement-breakpoint
CREATE TABLE `meter_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`room_id` text NOT NULL,
	`event_date` text NOT NULL,
	`old_meter_number` text DEFAULT '' NOT NULL,
	`new_meter_number` text NOT NULL,
	`old_final_reading` real NOT NULL,
	`new_initial_reading` real NOT NULL,
	`reason` text NOT NULL,
	`photo_document_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_meter_events_tenancy_date` ON `meter_events` (`tenancy_id`,`event_date`);--> statement-breakpoint
CREATE TABLE `move_out_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`settlement_date` text NOT NULL,
	`outstanding_paise` integer NOT NULL,
	`credit_paise` integer DEFAULT 0 NOT NULL,
	`deposit_held_paise` integer DEFAULT 0 NOT NULL,
	`deduction_paise` integer DEFAULT 0 NOT NULL,
	`refund_paise` integer DEFAULT 0 NOT NULL,
	`remaining_debt_paise` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_moveout_settlement_tenancy` ON `move_out_settlements` (`tenancy_id`);--> statement-breakpoint
CREATE INDEX `idx_settlements_owner_date` ON `move_out_settlements` (`owner_key`,`settlement_date`);--> statement-breakpoint
CREATE TABLE `recurring_expense_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`property_id` text NOT NULL,
	`room_id` text,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`payee` text DEFAULT '' NOT NULL,
	`day_of_month` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_recurring_expenses_owner` ON `recurring_expense_templates` (`owner_key`,`active`);--> statement-breakpoint
CREATE TABLE `room_availability_history` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`room_id` text NOT NULL,
	`status` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_room_availability_period` ON `room_availability_history` (`owner_key`,`room_id`,`effective_from`);--> statement-breakpoint
ALTER TABLE `payment_allocations` ADD `reversed_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_allocation_payment_charge` ON `payment_allocations` (`payment_id`,`charge_type`,`charge_id`);--> statement-breakpoint
CREATE TRIGGER `prevent_rent_overallocation` BEFORE INSERT ON `payment_allocations` WHEN NEW.reversed=0 AND NEW.charge_type='rent' AND NEW.amount_paise + COALESCE((SELECT SUM(amount_paise) FROM payment_allocations WHERE charge_type='rent' AND charge_id=NEW.charge_id AND reversed=0),0) > COALESCE((SELECT amount_paise FROM rent_charges WHERE id=NEW.charge_id AND owner_key=NEW.owner_key AND reversed=0),-1) BEGIN SELECT RAISE(ABORT, 'Allocation exceeds rent balance'); END;--> statement-breakpoint
CREATE TRIGGER `prevent_electricity_overallocation` BEFORE INSERT ON `payment_allocations` WHEN NEW.reversed=0 AND NEW.charge_type='electricity' AND NEW.amount_paise + COALESCE((SELECT SUM(amount_paise) FROM payment_allocations WHERE charge_type='electricity' AND charge_id=NEW.charge_id AND reversed=0),0) > COALESCE((SELECT total_paise FROM electricity_bills WHERE id=NEW.charge_id AND owner_key=NEW.owner_key AND reversed=0),-1) BEGIN SELECT RAISE(ABORT, 'Allocation exceeds electricity balance'); END;--> statement-breakpoint
CREATE TRIGGER `prevent_other_overallocation` BEFORE INSERT ON `payment_allocations` WHEN NEW.reversed=0 AND NEW.charge_type='other' AND NEW.amount_paise + COALESCE((SELECT SUM(amount_paise) FROM payment_allocations WHERE charge_type='other' AND charge_id=NEW.charge_id AND reversed=0),0) > COALESCE((SELECT amount_paise FROM other_charges WHERE id=NEW.charge_id AND owner_key=NEW.owner_key AND reversed=0 AND amount_paise>0),-1) BEGIN SELECT RAISE(ABORT, 'Allocation exceeds other charge balance'); END;--> statement-breakpoint
ALTER TABLE `payments` ADD `request_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_payments_owner_request` ON `payments` (`owner_key`,`request_key`);--> statement-breakpoint
ALTER TABLE `rooms` ADD `asking_rent_paise` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenancies` ADD `rent_proration_mode` text DEFAULT 'full_month' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenancies` ADD `agreement_end_date` text;--> statement-breakpoint
ALTER TABLE `tenancies` ADD `planned_move_out_date` text;
