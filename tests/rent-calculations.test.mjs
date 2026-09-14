import assert from "node:assert/strict";
import test from "node:test";

import { calculateMonthlyRent } from "../app/rent-calculations.ts";

test("calculates contractual rent before a monthly charge exists", () => {
  const result = calculateMonthlyRent(
    { id: "stay_1", rent_start_date: "2026-01-01", rent_proration_mode: "full_month" },
    [{ tenancy_id: "stay_1", amount_paise: 150000, effective_from: "2026-01-01" }],
    "2026-09",
  );
  assert.equal(result.amountPaise, 150000);
  assert.equal(result.note, "Full-month rent");
});

test("prorates a partial month by occupied calendar days", () => {
  const result = calculateMonthlyRent(
    { id: "stay_1", rent_start_date: "2026-09-16", rent_proration_mode: "prorated" },
    [{ tenancy_id: "stay_1", amount_paise: 300000, effective_from: "2026-09-16" }],
    "2026-09",
  );
  assert.equal(result.amountPaise, 150000);
  assert.equal(result.occupiedDays, 15);
  assert.match(result.note, /Prorated for 15 of 30 days/);
});

test("uses effective-dated rates inside a prorated month", () => {
  const result = calculateMonthlyRent(
    { id: "stay_1", rent_start_date: "2026-09-01", rent_proration_mode: "prorated" },
    [
      { tenancy_id: "stay_1", amount_paise: 300000, effective_from: "2026-01-01", effective_to: "2026-09-15" },
      { tenancy_id: "stay_1", amount_paise: 600000, effective_from: "2026-09-16" },
    ],
    "2026-09",
  );
  assert.equal(result.amountPaise, 450000);
  assert.match(result.note, /2 effective rates applied/);
});

