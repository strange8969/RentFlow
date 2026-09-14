import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull().default(""),
  identityProvider: text("identity_provider").notNull().default("chatgpt"),
  emailVerifiedAt: text("email_verified_at").notNull(),
  status: text("status").notNull().default("active"),
  lastSeenAt: text("last_seen_at").notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("uq_users_email").on(t.email)]);

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdByUserId: text("created_by_user_id").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (t) => [index("idx_workspaces_creator").on(t.createdByUserId)]);

export const workspaceMemberships = sqliteTable("workspace_memberships", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull().default("owner"),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (t) => [
  uniqueIndex("uq_workspace_membership").on(t.workspaceId, t.userId),
  index("idx_workspace_membership_user_status").on(t.userId, t.status),
]);

export const properties = sqliteTable("properties", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(),
  name: text("name").notNull(), address: text("address").notNull().default(""), notes: text("notes").notNull().default(""),
  defaultRentDueDay: integer("default_rent_due_day").notNull().default(10),
  defaultElectricityRatePaise: integer("default_electricity_rate_paise").notNull().default(0),
  defaultElectricityFixedChargePaise: integer("default_electricity_fixed_charge_paise").notNull().default(0),
  defaultLateFeeMode: text("default_late_fee_mode").notNull().default("none"),
  defaultLateFeeValue: integer("default_late_fee_value").notNull().default(0),
  currency: text("currency").notNull().default("INR"), active: integer("active").notNull().default(1), ...timestamps,
}, (t) => [index("idx_properties_owner_active").on(t.ownerKey, t.active)]);

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), propertyId: text("property_id").notNull(),
  roomNumber: text("room_number").notNull(), normalizedRoomNumber: text("normalized_room_number").notNull(),
  floor: text("floor").notNull().default(""), meterNumber: text("meter_number").notNull().default(""),
  status: text("status").notNull().default("vacant"), notes: text("notes").notNull().default(""),
  askingRentPaise: integer("asking_rent_paise").notNull().default(0),
  active: integer("active").notNull().default(1), ...timestamps,
}, (t) => [uniqueIndex("uq_rooms_property_number").on(t.ownerKey, t.propertyId, t.normalizedRoomNumber), index("idx_rooms_owner_property").on(t.ownerKey, t.propertyId)]);

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), fullName: text("full_name").notNull(),
  phone: text("phone").notNull().default(""), alternatePhone: text("alternate_phone").notNull().default(""), email: text("email").notNull().default(""),
  idType: text("id_type").notNull().default(""), idNumberMasked: text("id_number_masked").notNull().default(""),
  permanentAddress: text("permanent_address").notNull().default(""), emergencyContactName: text("emergency_contact_name").notNull().default(""),
  emergencyContactPhone: text("emergency_contact_phone").notNull().default(""), notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("active"), ...timestamps,
}, (t) => [index("idx_tenants_owner_name").on(t.ownerKey, t.fullName)]);

export const tenancies = sqliteTable("tenancies", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), propertyId: text("property_id").notNull(), roomId: text("room_id").notNull(), tenantId: text("tenant_id").notNull(),
  moveInDate: text("move_in_date").notNull(), rentStartDate: text("rent_start_date").notNull(), moveOutDate: text("move_out_date"), noticeDate: text("notice_date"),
  rentDueDay: integer("rent_due_day").notNull(), securityDepositRequiredPaise: integer("security_deposit_required_paise").notNull().default(0),
  openingBalancePaise: integer("opening_balance_paise").notNull().default(0), initialMeterReading: real("initial_meter_reading"),
  rentProrationMode: text("rent_proration_mode").notNull().default("full_month"), agreementEndDate: text("agreement_end_date"), plannedMoveOutDate: text("planned_move_out_date"),
  status: text("status").notNull().default("active"), ...timestamps,
}, (t) => [index("idx_tenancies_owner_status").on(t.ownerKey, t.status), index("idx_tenancies_room_status").on(t.roomId, t.status), index("idx_tenancies_tenant").on(t.tenantId), uniqueIndex("uq_active_tenancy_room").on(t.ownerKey, t.roomId).where(sql`${t.status} IN ('active','notice')`)]);

export const rentRateHistory = sqliteTable("rent_rate_history", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenancyId: text("tenancy_id").notNull(),
  amountPaise: integer("amount_paise").notNull(), effectiveFrom: text("effective_from").notNull(), effectiveTo: text("effective_to"), ...timestamps,
}, (t) => [uniqueIndex("uq_rent_rate_effective").on(t.tenancyId, t.effectiveFrom), index("idx_rent_rates_tenancy").on(t.tenancyId, t.effectiveFrom)]);

export const electricityRateHistory = sqliteTable("electricity_rate_history", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenancyId: text("tenancy_id").notNull(),
  ratePaisePerUnit: integer("rate_paise_per_unit").notNull(), fixedChargePaise: integer("fixed_charge_paise").notNull().default(0),
  effectiveFrom: text("effective_from").notNull(), effectiveTo: text("effective_to"), tariffJson: text("tariff_json").notNull().default("{}"), ...timestamps,
}, (t) => [uniqueIndex("uq_electricity_rate_effective").on(t.tenancyId, t.effectiveFrom), index("idx_electricity_rates_tenancy").on(t.tenancyId, t.effectiveFrom)]);

export const rentCharges = sqliteTable("rent_charges", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenancyId: text("tenancy_id").notNull(), billingMonth: text("billing_month").notNull(),
  periodStart: text("period_start"), periodEnd: text("period_end"), amountPaise: integer("amount_paise").notNull(), dueDate: text("due_date").notNull(),
  source: text("source").notNull().default("generated"), note: text("note").notNull().default(""), reversed: integer("reversed").notNull().default(0), ...timestamps,
}, (t) => [uniqueIndex("uq_rent_charge_month_source").on(t.tenancyId, t.billingMonth, t.source), index("idx_rent_charges_owner_month").on(t.ownerKey, t.billingMonth)]);

export const electricityReadings = sqliteTable("electricity_readings", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenancyId: text("tenancy_id").notNull(), billingMonth: text("billing_month").notNull(),
  previousReading: real("previous_reading").notNull(), currentReading: real("current_reading").notNull(), units: real("units").notNull(), readingDate: text("reading_date").notNull(),
  meterNumberSnapshot: text("meter_number_snapshot").notNull().default(""), photoDocumentId: text("photo_document_id"), notes: text("notes").notNull().default(""), status: text("status").notNull().default("draft"), ...timestamps,
}, (t) => [uniqueIndex("uq_reading_tenancy_month").on(t.tenancyId, t.billingMonth), index("idx_readings_owner_month").on(t.ownerKey, t.billingMonth)]);

export const electricityBills = sqliteTable("electricity_bills", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenancyId: text("tenancy_id").notNull(), readingId: text("reading_id").notNull(), billingMonth: text("billing_month").notNull(),
  units: real("units").notNull(), ratePaisePerUnit: integer("rate_paise_per_unit").notNull(), energyChargePaise: integer("energy_charge_paise").notNull(), fixedChargePaise: integer("fixed_charge_paise").notNull().default(0), adjustmentPaise: integer("adjustment_paise").notNull().default(0), totalPaise: integer("total_paise").notNull(), dueDate: text("due_date"), billNumber: text("bill_number"), reversed: integer("reversed").notNull().default(0), ...timestamps,
}, (t) => [uniqueIndex("uq_electricity_bill_tenancy_month").on(t.tenancyId, t.billingMonth), index("idx_electricity_bills_owner_month").on(t.ownerKey, t.billingMonth)]);

export const otherCharges = sqliteTable("other_charges", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenancyId: text("tenancy_id").notNull(),
  chargeDate: text("charge_date").notNull(), chargeType: text("charge_type").notNull(), amountPaise: integer("amount_paise").notNull(), description: text("description").notNull(), documentId: text("document_id"), reversed: integer("reversed").notNull().default(0), ...timestamps,
}, (t) => [index("idx_other_charges_tenancy_date").on(t.tenancyId, t.chargeDate)]);

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenancyId: text("tenancy_id").notNull(), tenantId: text("tenant_id").notNull(),
  amountPaise: integer("amount_paise").notNull(), paymentDate: text("payment_date").notNull(), mode: text("mode").notNull(), reference: text("reference").notNull().default(""), notes: text("notes").notNull().default(""), proofDocumentId: text("proof_document_id"), requestKey: text("request_key"), status: text("status").notNull().default("recorded"), reversedAt: text("reversed_at"), reversalReason: text("reversal_reason"), ...timestamps,
}, (t) => [index("idx_payments_owner_date").on(t.ownerKey, t.paymentDate), index("idx_payments_tenancy").on(t.tenancyId), uniqueIndex("uq_payments_owner_request").on(t.ownerKey, t.requestKey)]);

export const paymentAllocations = sqliteTable("payment_allocations", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), paymentId: text("payment_id").notNull(),
  chargeType: text("charge_type").notNull(), chargeId: text("charge_id").notNull(), amountPaise: integer("amount_paise").notNull(), reversed: integer("reversed").notNull().default(0), reversedAt: text("reversed_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_allocations_payment").on(t.paymentId), index("idx_allocations_charge").on(t.chargeType, t.chargeId)]);

export const depositLedger = sqliteTable("deposit_ledger", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenancyId: text("tenancy_id").notNull(),
  type: text("type").notNull(), amountPaise: integer("amount_paise").notNull(), date: text("date").notNull(), description: text("description").notNull().default(""), relatedChargeId: text("related_charge_id"), ...timestamps,
}, (t) => [index("idx_deposit_tenancy_date").on(t.tenancyId, t.date)]);

export const receipts = sqliteTable("receipts", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), receiptNumber: text("receipt_number").notNull(), paymentId: text("payment_id").notNull(), tenantId: text("tenant_id").notNull(), tenancyId: text("tenancy_id").notNull(), snapshotJson: text("snapshot_json").notNull(), status: text("status").notNull().default("issued"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("uq_receipt_number_owner").on(t.ownerKey, t.receiptNumber), uniqueIndex("uq_receipt_payment").on(t.paymentId)]);

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenantId: text("tenant_id"), tenancyId: text("tenancy_id"), roomId: text("room_id"),
  type: text("type").notNull(), filename: text("filename").notNull(), mimeType: text("mime_type").notNull(), size: integer("size").notNull(), objectKey: text("object_key").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("uq_documents_object_key").on(t.objectKey), index("idx_documents_owner_created").on(t.ownerKey, t.createdAt)]);

export const settings = sqliteTable("settings", {
  ownerKey: text("owner_key").primaryKey(), landlordName: text("landlord_name").notNull().default(""), currency: text("currency").notNull().default("INR"), timezone: text("timezone").notNull().default("Asia/Kolkata"), dateFormat: text("date_format").notNull().default("dd MMM yyyy"), billPrefix: text("bill_prefix").notNull().default("RF-BILL"), receiptPrefix: text("receipt_prefix").notNull().default("RF-RCPT"), defaultRentDueDay: integer("default_rent_due_day").notNull().default(10), upiId: text("upi_id").notNull().default(""), paymentInstructions: text("payment_instructions").notNull().default(""), billFooter: text("bill_footer").notNull().default(""), defaultElectricityRatePaise: integer("default_electricity_rate_paise").notNull().default(0), defaultElectricityFixedChargePaise: integer("default_electricity_fixed_charge_paise").notNull().default(0), maxFileSizeMb: integer("max_file_size_mb").notNull().default(20), ...timestamps,
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), action: text("action").notNull(), entityType: text("entity_type"), entityId: text("entity_id"), summary: text("summary").notNull(), actorContext: text("actor_context").notNull().default("owner"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_audit_owner_created").on(t.ownerKey, t.createdAt)]);

export const followUps = sqliteTable("follow_ups", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenantId: text("tenant_id").notNull(), tenancyId: text("tenancy_id"),
  note: text("note").notNull(), nextFollowUpDate: text("next_follow_up_date"), promisedPaymentDate: text("promised_payment_date"), status: text("status").notNull().default("open"), reminderDraft: text("reminder_draft").notNull().default(""), completedAt: text("completed_at"), ...timestamps,
}, (t) => [index("idx_followups_owner_date").on(t.ownerKey, t.status, t.nextFollowUpDate), index("idx_followups_tenant").on(t.tenantId, t.createdAt)]);

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), propertyId: text("property_id").notNull(), roomId: text("room_id"),
  category: text("category").notNull(), description: text("description").notNull(), amountPaise: integer("amount_paise").notNull(), incurredDate: text("incurred_date").notNull(), paidDate: text("paid_date"), payee: text("payee").notNull().default(""), paymentStatus: text("payment_status").notNull().default("unpaid"), documentId: text("document_id"), recurringTemplateId: text("recurring_template_id"), ...timestamps,
}, (t) => [index("idx_expenses_owner_date").on(t.ownerKey, t.incurredDate), index("idx_expenses_property").on(t.propertyId, t.incurredDate)]);

export const recurringExpenseTemplates = sqliteTable("recurring_expense_templates", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), propertyId: text("property_id").notNull(), roomId: text("room_id"), category: text("category").notNull(), description: text("description").notNull(), amountPaise: integer("amount_paise").notNull(), payee: text("payee").notNull().default(""), dayOfMonth: integer("day_of_month").notNull().default(1), active: integer("active").notNull().default(1), ...timestamps,
}, (t) => [index("idx_recurring_expenses_owner").on(t.ownerKey, t.active)]);

export const maintenanceIssues = sqliteTable("maintenance_issues", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), propertyId: text("property_id").notNull(), roomId: text("room_id"), title: text("title").notNull(), description: text("description").notNull().default(""), priority: text("priority").notNull().default("normal"), status: text("status").notNull().default("open"), reportedDate: text("reported_date").notNull(), dueDate: text("due_date"), completedDate: text("completed_date"), assignedTo: text("assigned_to").notNull().default(""), estimatedCostPaise: integer("estimated_cost_paise").notNull().default(0), actualCostPaise: integer("actual_cost_paise").notNull().default(0), expenseId: text("expense_id"), documentId: text("document_id"), ...timestamps,
}, (t) => [index("idx_maintenance_owner_status").on(t.ownerKey, t.status, t.dueDate)]);

export const roomAvailabilityHistory = sqliteTable("room_availability_history", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), roomId: text("room_id").notNull(), status: text("status").notNull(), effectiveFrom: text("effective_from").notNull(), effectiveTo: text("effective_to"), reason: text("reason").notNull().default(""), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_room_availability_period").on(t.ownerKey, t.roomId, t.effectiveFrom)]);

export const meterEvents = sqliteTable("meter_events", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenancyId: text("tenancy_id").notNull(), roomId: text("room_id").notNull(), eventDate: text("event_date").notNull(), oldMeterNumber: text("old_meter_number").notNull().default(""), newMeterNumber: text("new_meter_number").notNull(), oldFinalReading: real("old_final_reading").notNull(), newInitialReading: real("new_initial_reading").notNull(), reason: text("reason").notNull(), photoDocumentId: text("photo_document_id"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_meter_events_tenancy_date").on(t.tenancyId, t.eventDate)]);

export const moveOutSettlements = sqliteTable("move_out_settlements", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenancyId: text("tenancy_id").notNull(), settlementDate: text("settlement_date").notNull(), outstandingPaise: integer("outstanding_paise").notNull(), creditPaise: integer("credit_paise").notNull().default(0), depositHeldPaise: integer("deposit_held_paise").notNull().default(0), deductionPaise: integer("deduction_paise").notNull().default(0), refundPaise: integer("refund_paise").notNull().default(0), refundPaidPaise: integer("refund_paid_paise").notNull().default(0), refundPaidAt: text("refund_paid_at"), remainingDebtPaise: integer("remaining_debt_paise").notNull().default(0), notes: text("notes").notNull().default(""), snapshotJson: text("snapshot_json").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("uq_moveout_settlement_tenancy").on(t.tenancyId), index("idx_settlements_owner_date").on(t.ownerKey, t.settlementDate)]);

export const operationRequests = sqliteTable("operation_requests", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), requestKey: text("request_key").notNull(), action: text("action").notNull(), responseJson: text("response_json").notNull().default("{}"), completedAt: text("completed_at").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("uq_operation_request").on(t.ownerKey, t.requestKey), index("idx_operation_requests_owner").on(t.ownerKey, t.createdAt)]);

export const monthlyClosings = sqliteTable("monthly_closings", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), propertyId: text("property_id"), billingMonth: text("billing_month").notNull(), status: text("status").notNull().default("draft"), exceptionReason: text("exception_reason").notNull().default(""), snapshotJson: text("snapshot_json").notNull().default("{}"), reviewedAt: text("reviewed_at"), closedAt: text("closed_at"), reopenedAt: text("reopened_at"), reopenedReason: text("reopened_reason").notNull().default(""), ...timestamps,
}, (t) => [uniqueIndex("uq_monthly_closing_scope").on(t.ownerKey, t.propertyId, t.billingMonth), index("idx_monthly_closings_owner_month").on(t.ownerKey, t.billingMonth)]);

export const communicationTemplates = sqliteTable("communication_templates", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), kind: text("kind").notNull(), name: text("name").notNull(), body: text("body").notNull(), active: integer("active").notNull().default(1), ...timestamps,
}, (t) => [uniqueIndex("uq_communication_template_kind").on(t.ownerKey, t.kind)]);

export const communicationEvents = sqliteTable("communication_events", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenantId: text("tenant_id").notNull(), tenancyId: text("tenancy_id"), templateKind: text("template_kind").notNull(), channel: text("channel").notNull(), recipient: text("recipient").notNull(), messageSnapshot: text("message_snapshot").notNull(), status: text("status").notNull().default("prepared"), providerMessageId: text("provider_message_id"), nextFollowUpDate: text("next_follow_up_date"), promisedPaymentDate: text("promised_payment_date"), createdByUserId: text("created_by_user_id").notNull(), ...timestamps,
}, (t) => [index("idx_communication_tenant").on(t.ownerKey, t.tenantId, t.createdAt)]);

export const communicationPreferences = sqliteTable("communication_preferences", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenantId: text("tenant_id").notNull(), channel: text("channel").notNull(), optedOut: integer("opted_out").notNull().default(0), reason: text("reason").notNull().default(""), ...timestamps,
}, (t) => [uniqueIndex("uq_communication_preference").on(t.ownerKey, t.tenantId, t.channel)]);

export const bankImports = sqliteTable("bank_imports", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), filename: text("filename").notNull(), fileHash: text("file_hash").notNull(), mappingJson: text("mapping_json").notNull(), rowCount: integer("row_count").notNull(), importedAt: text("imported_at").notNull(), ...timestamps,
}, (t) => [uniqueIndex("uq_bank_import_hash").on(t.ownerKey, t.fileHash)]);

export const bankTransactions = sqliteTable("bank_transactions", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), importId: text("import_id").notNull(), transactionDate: text("transaction_date").notNull(), amountPaise: integer("amount_paise").notNull(), direction: text("direction").notNull(), description: text("description").notNull(), reference: text("reference").notNull().default(""), fingerprint: text("fingerprint").notNull(), status: text("status").notNull().default("unmatched"), version: integer("version").notNull().default(1), ...timestamps,
}, (t) => [uniqueIndex("uq_bank_transaction_fingerprint").on(t.ownerKey, t.fingerprint), index("idx_bank_transactions_inbox").on(t.ownerKey, t.status, t.transactionDate)]);

export const reconciliationMatches = sqliteTable("reconciliation_matches", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), bankTransactionId: text("bank_transaction_id").notNull(), paymentId: text("payment_id"), expenseId: text("expense_id"), depositLedgerId: text("deposit_ledger_id"), matchType: text("match_type").notNull(), evidenceJson: text("evidence_json").notNull().default("{}"), createdPayment: integer("created_payment").notNull().default(0), reversedAt: text("reversed_at"), reversalReason: text("reversal_reason"), ...timestamps,
}, (t) => [index("idx_reconciliation_transaction").on(t.ownerKey, t.bankTransactionId, t.createdAt)]);

export const paymentRequests = sqliteTable("payment_requests", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenancyId: text("tenancy_id").notNull(), tenantId: text("tenant_id").notNull(), amountPaise: integer("amount_paise").notNull(), reference: text("reference").notNull(), expiresAt: text("expires_at").notNull(), status: text("status").notNull().default("pending"), upiUri: text("upi_uri").notNull().default(""), provider: text("provider").notNull().default("manual_upi"), providerRequestId: text("provider_request_id"), confirmedPaymentId: text("confirmed_payment_id"), requestKey: text("request_key").notNull(), ...timestamps,
}, (t) => [uniqueIndex("uq_payment_request_key").on(t.ownerKey, t.requestKey), index("idx_payment_requests_tenancy").on(t.ownerKey, t.tenancyId, t.createdAt)]);

export const inspections = sqliteTable("inspections", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), propertyId: text("property_id").notNull(), roomId: text("room_id").notNull(), tenantId: text("tenant_id"), tenancyId: text("tenancy_id"), inspectionType: text("inspection_type").notNull(), inspectionDate: text("inspection_date").notNull(), status: text("status").notNull().default("draft"), meterNumber: text("meter_number").notNull().default(""), meterReading: real("meter_reading"), keysJson: text("keys_json").notNull().default("[]"), notes: text("notes").notNull().default(""), acknowledgementStatus: text("acknowledgement_status").notNull().default("pending"), snapshotJson: text("snapshot_json").notNull().default("{}"), ...timestamps,
}, (t) => [index("idx_inspections_room_date").on(t.ownerKey, t.roomId, t.inspectionDate)]);

export const inspectionItems = sqliteTable("inspection_items", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), inspectionId: text("inspection_id").notNull(), area: text("area").notNull(), itemName: text("item_name").notNull(), condition: text("condition").notNull(), existingDamage: integer("existing_damage").notNull().default(0), description: text("description").notNull().default(""), photoDocumentId: text("photo_document_id"), proposedDeductionPaise: integer("proposed_deduction_paise").notNull().default(0), deductionStatus: text("deduction_status").notNull().default("proposed"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_inspection_items_inspection").on(t.ownerKey, t.inspectionId)]);

export const leaseRenewals = sqliteTable("lease_renewals", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), tenancyId: text("tenancy_id").notNull(), proposedRentPaise: integer("proposed_rent_paise").notNull(), proposedDepositPaise: integer("proposed_deposit_paise").notNull().default(0), proposedStartDate: text("proposed_start_date").notNull(), proposedEndDate: text("proposed_end_date"), noticeTerms: text("notice_terms").notNull().default(""), status: text("status").notNull().default("draft"), tenantResponse: text("tenant_response").notNull().default(""), acceptedAt: text("accepted_at"), approvedAt: text("approved_at"), agreementDocumentId: text("agreement_document_id"), ...timestamps,
}, (t) => [index("idx_renewals_tenancy_status").on(t.ownerKey, t.tenancyId, t.status)]);

export const workspaceInvitations = sqliteTable("workspace_invitations", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), email: text("email").notNull(), role: text("role").notNull(), tokenHash: text("token_hash").notNull(), status: text("status").notNull().default("pending"), expiresAt: text("expires_at").notNull(), invitedByUserId: text("invited_by_user_id").notNull(), acceptedByUserId: text("accepted_by_user_id"), acceptedAt: text("accepted_at"), ...timestamps,
}, (t) => [uniqueIndex("uq_workspace_invitation_token").on(t.tokenHash), index("idx_workspace_invitations_email").on(t.email, t.status)]);

export const onboardingProgress = sqliteTable("onboarding_progress", {
  ownerKey: text("owner_key").primaryKey(), currentStep: integer("current_step").notNull().default(1), completedStepsJson: text("completed_steps_json").notNull().default("[]"), dismissedAt: text("dismissed_at"), ...timestamps,
});

export const subscriptionPlans = sqliteTable("subscription_plans", {
  id: text("id").primaryKey(), name: text("name").notNull(), roomLimit: integer("room_limit").notNull(), featuresJson: text("features_json").notNull().default("[]"), pricePaise: integer("price_paise"), active: integer("active").notNull().default(1), ...timestamps,
});

export const workspaceSubscriptions = sqliteTable("workspace_subscriptions", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), planId: text("plan_id").notNull(), status: text("status").notNull().default("trial"), trialEndsAt: text("trial_ends_at"), currentPeriodEnd: text("current_period_end"), provider: text("provider").notNull().default("test"), providerCustomerId: text("provider_customer_id"), providerSubscriptionId: text("provider_subscription_id"), graceEndsAt: text("grace_ends_at"), ...timestamps,
}, (t) => [uniqueIndex("uq_workspace_subscription").on(t.ownerKey)]);

export const backupSnapshots = sqliteTable("backup_snapshots", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), backupType: text("backup_type").notNull(), status: text("status").notNull().default("verified"), schemaVersion: integer("schema_version").notNull(), recordCount: integer("record_count").notNull(), documentCount: integer("document_count").notNull().default(0), checksum: text("checksum").notNull(), objectKey: text("object_key"), verificationJson: text("verification_json").notNull().default("{}"), createdByUserId: text("created_by_user_id").notNull(), verifiedAt: text("verified_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_backups_owner_created").on(t.ownerKey, t.createdAt)]);
