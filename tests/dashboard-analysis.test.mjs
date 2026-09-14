import assert from "node:assert/strict";
import test from "node:test";

import { buildDashboardAnalysis } from "../app/dashboard-analysis.ts";

function data() {
  return {
    properties: [{ id: "p1", name: "Alpha", active: 1 }, { id: "p2", name: "Beta", active: 1 }],
    rooms: [{ id: "r1", property_id: "p1", room_number: "1", active: 1 }, { id: "r2", property_id: "p2", room_number: "2", active: 1 }],
    tenants: [{ id: "u1", full_name: "Active Tenant" }, { id: "u2", full_name: "Former Tenant" }],
    tenancies: [
      { id: "t1", tenant_id: "u1", property_id: "p1", room_id: "r1", status: "active", rent_start_date: "2026-01-01", rent_proration_mode: "full_month", security_deposit_required_paise: 0 },
      { id: "t2", tenant_id: "u2", property_id: "p2", room_id: "r2", status: "moved_out", rent_start_date: "2026-01-01", move_out_date: "2026-08-31", security_deposit_required_paise: 0 },
    ],
    rentRateHistory: [{ tenancy_id: "t1", amount_paise: 200000, effective_from: "2026-01-01" }],
    rentCharges: [{ id: "c1", tenancy_id: "t1", billing_month: "2026-09", amount_paise: 200000, due_date: "2026-09-10", reversed: 0 }, { id: "old", tenancy_id: "t2", billing_month: "2026-08", amount_paise: 50000, due_date: "2026-08-10", reversed: 0 }],
    electricityBills: [], electricityReadings: [], otherCharges: [], deposits: [], expenses: [], followUps: [], maintenanceIssues: [],
    payments: [{ id: "pay1", tenancy_id: "t1", amount_paise: 150000, payment_date: "2026-09-12", status: "recorded" }],
    allocations: [{ payment_id: "pay1", charge_type: "rent", charge_id: "c1", amount_paise: 100000, reversed: 0 }],
  };
}

test("separates cash received from bill allocations and keeps unapplied credit visible", () => {
  const result = buildDashboardAnalysis(data(), "2026-09");
  assert.equal(result.expectedRent, 200000);
  assert.equal(result.paymentsReceived, 150000);
  assert.equal(result.collectionsAgainstBills, 100000);
  assert.equal(result.unappliedCredit, 50000);
  assert.ok(result.tenantDues.some((row) => row.tenant === "Former Tenant" && row.amount === 50000));
});

test("applies the property filter to money and occupancy metrics", () => {
  const result = buildDashboardAnalysis(data(), "2026-09", "p1");
  assert.equal(result.outstanding, 100000);
  assert.deepEqual(result.occupancy, { occupied: 1, total: 1 });
  assert.deepEqual(result.properties.map((row) => row.id), ["p1"]);
});

