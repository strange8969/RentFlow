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
  amountPaise: integer("amount_paise").notNull(), paymentDate: text("payment_date").notNull(), mode: text("mode").notNull(), reference: text("reference").notNull().default(""), notes: text("notes").notNull().default(""), proofDocumentId: text("proof_document_id"), status: text("status").notNull().default("recorded"), reversedAt: text("reversed_at"), reversalReason: text("reversal_reason"), ...timestamps,
}, (t) => [index("idx_payments_owner_date").on(t.ownerKey, t.paymentDate), index("idx_payments_tenancy").on(t.tenancyId)]);

export const paymentAllocations = sqliteTable("payment_allocations", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), paymentId: text("payment_id").notNull(),
  chargeType: text("charge_type").notNull(), chargeId: text("charge_id").notNull(), amountPaise: integer("amount_paise").notNull(), reversed: integer("reversed").notNull().default(0), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
