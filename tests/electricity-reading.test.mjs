import assert from "node:assert/strict";
import test from "node:test";

function createDatabase() {
  const prepared = [];
  const batches = [];
  return {
    prepared,
    batches,
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes("FROM workspace_memberships wm JOIN workspaces w")) return { workspace_id: "landlord_1", workspace_name: "Asha’s workspace", role: "owner" };
          if (sql.startsWith("SELECT * FROM tenancies")) return { id: "tenancy_1", owner_key: "landlord_1", room_id: "room_1", initial_meter_reading: 80 };
          if (sql.startsWith("SELECT id FROM electricity_readings")) return null;
          if (sql.startsWith("SELECT current_reading, billing_month FROM electricity_readings")) return { current_reading: 120, billing_month: "2026-08" };
          if (sql.startsWith("SELECT rate_paise_per_unit, fixed_charge_paise FROM electricity_rate_history")) return { rate_paise_per_unit: 850, fixed_charge_paise: 10000 };
          return null;
        },
        async all() { return { results: [] }; },
      };
      prepared.push(statement);
      return statement;
    },
    async batch(statements) { batches.push(statements); return statements.map(() => ({ success: true })); },
  };
}

function readingRequest(payload) {
  return new Request("http://localhost/api/action", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-id": "landlord_1",
      "oai-authenticated-user-email": "asha@example.com",
      "oai-authenticated-user-full-name": "Asha",
      "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
    },
    body: JSON.stringify({ action: "record_electricity", payload }),
  });
}

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("electricity-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

test("requires a reason when the remembered previous reading is changed", async () => {
  const worker = await loadWorker();
  const database = createDatabase();
  const response = await worker.fetch(readingRequest({
    tenancyId: "tenancy_1",
    billingMonth: "2026-09",
    previousReading: 115,
    currentReading: 125,
    readingDate: "2026-09-03",
    dueDate: "2026-09-10",
    finalize: true,
  }), { DB: database, BUCKET: {}, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Reason for changing the previous reading is required/);
  assert.equal(database.prepared.some((item) => item.sql.startsWith("INSERT INTO electricity_readings")), false);
});

test("records an explained correction and creates a zero-adjustment bill", async () => {
  const worker = await loadWorker();
  const database = createDatabase();
  const response = await worker.fetch(readingRequest({
    tenancyId: "tenancy_1",
    billingMonth: "2026-09",
    previousReading: 115,
    currentReading: 125,
    readingDate: "2026-09-03",
    dueDate: "2026-09-10",
    notes: "Photo stored separately",
    previousReadingOverrideReason: "The old meter was corrected after inspection",
    adjustmentPaise: 999999,
    finalize: true,
  }), { DB: database, BUCKET: {}, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.adjustmentPaise, 0);
  assert.equal(body.result.totalPaise, 18500);
  assert.equal(body.result.previousReadingSource, "2026-08");

  const readingInsert = database.prepared.find((item) => item.sql.startsWith("INSERT INTO electricity_readings"));
  assert.ok(readingInsert);
  assert.match(readingInsert.values[9], /Photo stored separately/);
  assert.match(readingInsert.values[9], /changed from 120 \(2026-08\) to 115/);
  assert.match(readingInsert.values[9], /old meter was corrected/);

  const billInsert = database.prepared.find((item) => item.sql.startsWith("INSERT INTO electricity_bills"));
  assert.ok(billInsert);
  assert.equal(billInsert.values[9], 0);
  assert.equal(billInsert.values[10], 18500);
});
