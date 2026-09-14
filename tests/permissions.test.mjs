import assert from "node:assert/strict";
import test from "node:test";

import { hasPermission } from "../app/permissions.ts";

test("workspace roles enforce destructive and financial boundaries", () => {
  assert.equal(hasPermission("owner", "records.erase"), true);
  assert.equal(hasPermission("manager", "period.close"), true);
  assert.equal(hasPermission("manager", "period.reopen"), false);
  assert.equal(hasPermission("accountant", "finance.write"), true);
  assert.equal(hasPermission("read_only", "finance.write"), false);
  assert.equal(hasPermission("read_only", "exports.read"), true);
});
