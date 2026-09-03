import assert from "node:assert/strict";
import test from "node:test";

import { combinedBillSummary } from "../app/billing-summary.ts";

test("combined bill includes allocations to both rent and electricity", () => {
  const summary = combinedBillSummary({
    rentCharge: { id: "rent_1", amount_paise: 200000 },
    electricityBill: { id: "electricity_1", total_paise: 60100 },
    otherCharges: [],
    previousOutstanding: 0,
    allocationsByCharge: {
      "rent:rent_1": 150000,
      "electricity:electricity_1": 60100,
    },
  });

  assert.deepEqual(summary, {
    rent: 200000,
    electricity: 60100,
    other: 0,
    paid: 210100,
    total: 260100,
    balance: 50000,
  });
});

test("combined bill includes allocations to current other charges without double-counting prior open balances", () => {
  const summary = combinedBillSummary({
    rentCharge: { id: "rent_1", amount_paise: 200000 },
    electricityBill: null,
    otherCharges: [{ id: "other_1", amount_paise: 30000 }],
    previousOutstanding: 25000,
    allocationsByCharge: {
      "rent:rent_1": 50000,
      "other:other_1": 10000,
      "rent:old_rent": 75000,
    },
  });

  assert.equal(summary.total, 255000);
  assert.equal(summary.paid, 60000);
  assert.equal(summary.balance, 195000);
});
