import assert from "node:assert/strict";
import test from "node:test";

function createDatabase(workspaceNames) {
  const prepared = [];
  return {
    prepared,
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes("FROM workspace_memberships wm JOIN workspaces w")) {
            const userId = String(this.values[0]);
            return { workspace_id: userId, workspace_name: workspaceNames[userId], role: "owner" };
          }
          return null;
        },
        async all() { return { results: [] }; },
      };
      prepared.push(statement);
      return statement;
    },
    async batch(statements) { return statements.map(() => ({ success: true })); },
  };
}

test("provisions and scopes a separate workspace for each verified landlord", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("workspace-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const database = createDatabase({ landlord_a: "Asha’s workspace", landlord_b: "Ben’s workspace" });
  const runtime = {
    DB: database,
    BUCKET: {},
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  const context = { waitUntil() {}, passThroughOnException() {} };

  for (const [id, email, fullName, workspaceName] of [
    ["landlord_a", "asha@example.com", "Asha", "Asha’s workspace"],
    ["landlord_b", "ben@example.com", "Ben", "Ben’s workspace"],
  ]) {
    const before = database.prepared.length;
    const response = await worker.fetch(
      new Request("http://localhost/api/state", {
        headers: {
          "oai-authenticated-user-id": id,
          "oai-authenticated-user-email": email,
          "oai-authenticated-user-full-name": encodeURIComponent(fullName),
          "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
        },
      }),
      runtime,
      context,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.owner, { name: fullName, email });
    assert.deepEqual(body.workspace, { name: workspaceName, role: "owner" });

    const statements = database.prepared.slice(before);
    assert.ok(statements.some((item) => item.sql.startsWith("INSERT INTO users") && item.values[0] === id));
    assert.ok(statements.some((item) => item.sql.startsWith("INSERT OR IGNORE INTO workspaces") && item.values[0] === id));
    assert.ok(statements.some((item) => item.sql.startsWith("INSERT OR IGNORE INTO workspace_memberships") && item.values[1] === id && item.values[2] === id));
    const businessReads = statements.filter((item) => /SELECT \* FROM (properties|rooms|tenants|tenancies|payments|documents|audit_log)/.test(item.sql));
    assert.ok(businessReads.length >= 7);
    assert.ok(businessReads.every((item) => item.values[0] === id));
  }
});
