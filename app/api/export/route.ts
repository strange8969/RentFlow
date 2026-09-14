import { database, jsonError, requireOwner, requirePermission, rows } from "../_lib";

export const dynamic = "force-dynamic";

const tables = ["properties", "rooms", "tenants", "tenancies", "rent_rate_history", "electricity_rate_history", "rent_charges", "electricity_readings", "electricity_bills", "other_charges", "payments", "payment_allocations", "deposit_ledger", "receipts", "documents", "follow_ups", "expenses", "recurring_expense_templates", "maintenance_issues", "room_availability_history", "meter_events", "move_out_settlements", "monthly_closings", "communication_templates", "communication_events", "communication_preferences", "bank_imports", "bank_transactions", "reconciliation_matches", "payment_requests", "inspections", "inspection_items", "lease_renewals", "workspace_invitations", "onboarding_progress", "workspace_subscriptions", "backup_snapshots", "settings", "audit_log"];

export async function GET() {
  try {
    const owner = await requireOwner(); requirePermission(owner, "exports.read"); const db = database(); const records: Record<string, unknown[]> = {};
    for (const table of tables) records[table] = await rows(db.prepare(`SELECT * FROM ${table} WHERE owner_key=?`).bind(owner.key));
    const payload = { schemaVersion: 5, exportedAt: new Date().toISOString(), workspace: { id: owner.key, name: owner.workspaceName }, includesPrivateDocumentBytes: false, records };
    return new Response(JSON.stringify(payload, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="rentflow-structured-backup-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
