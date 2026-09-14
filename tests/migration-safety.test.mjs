import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

test("all additive migrations apply and allocation triggers reject overpayment", () => {
  const database = new DatabaseSync(":memory:");
  for (const filename of readdirSync(new URL("../drizzle/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = readFileSync(new URL(`../drizzle/${filename}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", "");
    database.exec(sql);
  }
  assert.equal(database.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  assert.equal(database.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table'").get().count, 27);
  assert.equal(database.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='trigger'").get().count, 3);

  database.exec("INSERT INTO rent_charges (id, owner_key, tenancy_id, billing_month, amount_paise, due_date) VALUES ('charge','workspace','tenancy','2026-09',10000,'2026-09-10')");
  database.exec("INSERT INTO payment_allocations (id, owner_key, payment_id, charge_type, charge_id, amount_paise) VALUES ('a1','workspace','payment1','rent','charge',8000)");
  assert.throws(() => database.exec("INSERT INTO payment_allocations (id, owner_key, payment_id, charge_type, charge_id, amount_paise) VALUES ('a2','workspace','payment2','rent','charge',3000)"), /Allocation exceeds rent balance/);
});

