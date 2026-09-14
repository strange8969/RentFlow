import { database, jsonError, requireOwner, rows, one } from "../_lib";

export const dynamic = "force-dynamic";

const defaultSettings = (ownerKey: string) => ({ owner_key: ownerKey, landlord_name: "", currency: "INR", timezone: "Asia/Kolkata", date_format: "dd MMM yyyy", bill_prefix: "RF-BILL", receipt_prefix: "RF-RCPT", default_rent_due_day: 10, upi_id: "", payment_instructions: "", bill_footer: "", default_electricity_rate_paise: 0, default_electricity_fixed_charge_paise: 0, max_file_size_mb: 20 });

export async function GET() {
  try {
    const owner = await requireOwner();
    const db = database();
    const q = (sql: string) => rows(db.prepare(sql).bind(owner.key));
    const [properties, rooms, tenants, tenancies, rentRates, electricityRates, rentCharges, electricityReadings, electricityBills, otherCharges, payments, allocations, deposits, receipts, documents, auditLog, followUps, expenses, recurringExpenses, maintenanceIssues, roomAvailability, meterEvents, settlements, savedSettings] = await Promise.all([
      q("SELECT * FROM properties WHERE owner_key = ? ORDER BY active DESC, name COLLATE NOCASE"),
      q("SELECT * FROM rooms WHERE owner_key = ? ORDER BY active DESC, room_number COLLATE NOCASE"),
      q("SELECT * FROM tenants WHERE owner_key = ? ORDER BY status, full_name COLLATE NOCASE"),
      q("SELECT * FROM tenancies WHERE owner_key = ? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'notice' THEN 1 ELSE 2 END, move_in_date DESC"),
      q("SELECT * FROM rent_rate_history WHERE owner_key = ? ORDER BY effective_from DESC"),
      q("SELECT * FROM electricity_rate_history WHERE owner_key = ? ORDER BY effective_from DESC"),
      q("SELECT * FROM rent_charges WHERE owner_key = ? AND reversed = 0 ORDER BY billing_month DESC, due_date"),
      q("SELECT * FROM electricity_readings WHERE owner_key = ? ORDER BY billing_month DESC"),
      q("SELECT * FROM electricity_bills WHERE owner_key = ? AND reversed = 0 ORDER BY billing_month DESC"),
      q("SELECT * FROM other_charges WHERE owner_key = ? AND reversed = 0 ORDER BY charge_date DESC"),
      q("SELECT * FROM payments WHERE owner_key = ? ORDER BY payment_date DESC, created_at DESC"),
      q("SELECT * FROM payment_allocations WHERE owner_key = ? AND reversed = 0 ORDER BY created_at"),
      q("SELECT * FROM deposit_ledger WHERE owner_key = ? ORDER BY date DESC"),
      q("SELECT * FROM receipts WHERE owner_key = ? ORDER BY created_at DESC"),
      q("SELECT * FROM documents WHERE owner_key = ? ORDER BY created_at DESC"),
      q("SELECT * FROM audit_log WHERE owner_key = ? ORDER BY created_at DESC"),
      q("SELECT * FROM follow_ups WHERE owner_key = ? ORDER BY COALESCE(next_follow_up_date, created_at) DESC"),
      q("SELECT * FROM expenses WHERE owner_key = ? ORDER BY incurred_date DESC, created_at DESC"),
      q("SELECT * FROM recurring_expense_templates WHERE owner_key = ? ORDER BY active DESC, created_at DESC"),
      q("SELECT * FROM maintenance_issues WHERE owner_key = ? ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, COALESCE(due_date, reported_date)"),
      q("SELECT * FROM room_availability_history WHERE owner_key = ? ORDER BY effective_from DESC"),
      q("SELECT * FROM meter_events WHERE owner_key = ? ORDER BY event_date DESC"),
      q("SELECT * FROM move_out_settlements WHERE owner_key = ? ORDER BY settlement_date DESC"),
      one(db.prepare("SELECT * FROM settings WHERE owner_key = ?").bind(owner.key)),
    ]);
    return Response.json({ schemaVersion: 5, exportedAt: new Date().toISOString(), owner: { name: owner.name, email: owner.email }, workspace: { name: owner.workspaceName, role: owner.role }, settings: savedSettings ?? defaultSettings(owner.key), properties, rooms, tenants, tenancies, rentRates, electricityRates, rentCharges, electricityReadings, electricityBills, otherCharges, payments, allocations, deposits, receipts, documents, auditLog, followUps, expenses, recurringExpenses, maintenanceIssues, roomAvailability, meterEvents, settlements });
  } catch (error) { return jsonError(error); }
}
