import { database, jsonError, requireOwner, rows, one } from "../_lib";

export const dynamic = "force-dynamic";

const defaultSettings = (ownerKey: string) => ({ owner_key: ownerKey, landlord_name: "", currency: "INR", timezone: "Asia/Kolkata", date_format: "dd MMM yyyy", bill_prefix: "RF-BILL", receipt_prefix: "RF-RCPT", default_rent_due_day: 10, upi_id: "", payment_instructions: "", bill_footer: "", default_electricity_rate_paise: 0, default_electricity_fixed_charge_paise: 0, max_file_size_mb: 20 });

export async function GET() {
  try {
    const owner = await requireOwner();
    const db = database();
    const q = (sql: string) => rows(db.prepare(sql).bind(owner.key));
    const [properties, rooms, tenants, tenancies, rentRates, electricityRates, rentCharges, electricityReadings, electricityBills, otherCharges, payments, allocations, deposits, receipts, documents, auditLog, savedSettings] = await Promise.all([
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
      q("SELECT * FROM payments WHERE owner_key = ? ORDER BY payment_date DESC, created_at DESC LIMIT 500"),
      q("SELECT * FROM payment_allocations WHERE owner_key = ? AND reversed = 0 ORDER BY created_at"),
      q("SELECT * FROM deposit_ledger WHERE owner_key = ? ORDER BY date DESC"),
      q("SELECT * FROM receipts WHERE owner_key = ? ORDER BY created_at DESC LIMIT 500"),
      q("SELECT * FROM documents WHERE owner_key = ? ORDER BY created_at DESC LIMIT 500"),
      q("SELECT * FROM audit_log WHERE owner_key = ? ORDER BY created_at DESC LIMIT 100"),
      one(db.prepare("SELECT * FROM settings WHERE owner_key = ?").bind(owner.key)),
    ]);
    return Response.json({ owner: { name: owner.name, email: owner.email }, workspace: { name: owner.workspaceName, role: owner.role }, settings: savedSettings ?? defaultSettings(owner.key), properties, rooms, tenants, tenancies, rentRates, electricityRates, rentCharges, electricityReadings, electricityBills, otherCharges, payments, allocations, deposits, receipts, documents, auditLog });
  } catch (error) { return jsonError(error); }
}
