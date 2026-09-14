import assert from "node:assert/strict";
import test from "node:test";

import { financialSnapshot } from "../app/financial-engine.ts";

test("separates billed, received, allocated, unapplied and deposits", () => {
  const result = financialSnapshot({
    contractualRentPaise: 200000,
    charges: [{ id: "rent", tenancyId: "t1", type: "rent", amountPaise: 200000, dueDate: "2026-09-10" }],
    payments: [{ id: "payment", tenancyId: "t1", amountPaise: 150000, paymentDate: "2026-09-08", status: "recorded" }],
    allocations: [{ id: "a1", paymentId: "payment", chargeType: "rent", chargeId: "rent", amountPaise: 100000, createdAt: "2026-09-08T10:00:00Z" }],
    depositsHeldPaise: 50000,
  });
  assert.deepEqual(result, {
    contractualRentPaise: 200000, billedChargesPaise: 200000, cashReceivedPaise: 150000,
    allocatedPaise: 100000, unpaidBalancePaise: 100000, issuedCreditsPaise: 0,
    appliedCreditsPaise: 0, unappliedFundsPaise: 50000, depositsHeldPaise: 50000,
  });
});

test("historical snapshot excludes allocations created after the selected instant", () => {
  const result = financialSnapshot({
    charges: [{ id: "rent", tenancyId: "t1", type: "rent", amountPaise: 100000, dueDate: "2026-08-10" }],
    payments: [{ id: "payment", tenancyId: "t1", amountPaise: 100000, paymentDate: "2026-08-15", status: "recorded" }],
    allocations: [{ paymentId: "payment", chargeType: "rent", chargeId: "rent", amountPaise: 100000, createdAt: "2026-09-01T10:00:00Z" }],
    asOf: "2026-08-31T23:59:59Z",
  });
  assert.equal(result.cashReceivedPaise, 100000);
  assert.equal(result.allocatedPaise, 0);
  assert.equal(result.unpaidBalancePaise, 100000);
});
