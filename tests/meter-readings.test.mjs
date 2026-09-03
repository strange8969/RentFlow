import assert from "node:assert/strict";
import test from "node:test";

import { nextAvailableReadingMonth } from "../app/meter-readings.ts";

test("advances to the next month when the selected month already has a reading", () => {
  const readings = [
    { tenancy_id: "tenancy_1", billing_month: "2026-09" },
  ];

  assert.equal(nextAvailableReadingMonth(readings, "tenancy_1", "2026-09"), "2026-10");
});

test("skips consecutive recorded months only for the selected tenancy", () => {
  const readings = [
    { tenancy_id: "tenancy_1", billing_month: "2026-09" },
    { tenancy_id: "tenancy_1", billing_month: "2026-10" },
    { tenancy_id: "tenancy_2", billing_month: "2026-11" },
  ];

  assert.equal(nextAvailableReadingMonth(readings, "tenancy_1", "2026-09"), "2026-11");
  assert.equal(nextAvailableReadingMonth(readings, "tenancy_2", "2026-09"), "2026-09");
});
