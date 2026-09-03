import { headers } from "next/headers";

type RentFlowBindings = { DB?: D1Database; BUCKET?: R2Bucket };

export type Owner = {
  key: string;
  userKey: string;
  email: string;
  name: string;
  workspaceName: string;
  role: "owner";
};

export async function requireOwner(): Promise<Owner> {
  const h = await headers();
  const id = h.get("oai-authenticated-user-id");
  const email = h.get("oai-authenticated-user-email");
  if (!id || !email) throw new ApiError(401, "Sign in is required.");
  const encoded = h.get("oai-authenticated-user-full-name");
  const name = encoded && h.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
    ? safeDecode(encoded) ?? email : email;
  const db = database();
  const at = now();
  const workspaceName = defaultWorkspaceName(name, email);
  await db.batch([
    db.prepare("INSERT INTO users (id, email, display_name, identity_provider, email_verified_at, status, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, 'chatgpt', ?, 'active', ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email=excluded.email, display_name=excluded.display_name, last_seen_at=excluded.last_seen_at, updated_at=excluded.updated_at").bind(id, email.toLowerCase(), name, at, at, at, at),
    db.prepare("INSERT OR IGNORE INTO workspaces (id, name, created_by_user_id, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)").bind(id, workspaceName, id, at, at),
    db.prepare("INSERT OR IGNORE INTO workspace_memberships (id, workspace_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, 'owner', 'active', ?, ?)").bind(`membership_${id}`, id, id, at, at),
    db.prepare("INSERT OR IGNORE INTO audit_log (id, owner_key, action, entity_type, entity_id, summary, actor_context, created_at) VALUES (?, ?, 'account.workspace_created', 'workspace', ?, 'Created landlord workspace', ?, ?)").bind(`audit_workspace_${id}`, id, id, email, at),
  ]);
  const membership = await one<{ workspace_id: string; workspace_name: string; role: string }>(
    db.prepare("SELECT wm.workspace_id, w.name AS workspace_name, wm.role FROM workspace_memberships wm JOIN workspaces w ON w.id=wm.workspace_id WHERE wm.user_id=? AND wm.status='active' AND w.status='active' ORDER BY CASE wm.role WHEN 'owner' THEN 0 ELSE 1 END, wm.created_at LIMIT 1").bind(id),
  );
  if (!membership || membership.role !== "owner") throw new ApiError(403, "Your landlord workspace is unavailable.");
  return { key: membership.workspace_id, userKey: id, email, name, workspaceName: membership.workspace_name, role: "owner" };
}

export function database(): D1Database {
  const env = runtimeBindings();
  if (!env.DB) throw new ApiError(503, "RentFlow storage is unavailable. Your saved data has not been changed.");
  return env.DB;
}

export function bucket(): R2Bucket {
  const env = runtimeBindings();
  if (!env.BUCKET) throw new ApiError(503, "Private document storage is unavailable.");
  return env.BUCKET;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (/UNIQUE constraint failed/i.test(message)) return Response.json({ error: "That record conflicts with an existing saved record." }, { status: 409 });
  console.error("RentFlow request failed", message);
  return Response.json({ error: "The request could not be completed. Your existing data is unchanged." }, { status: 500 });
}

export function id(prefix = "rf") { return `${prefix}_${crypto.randomUUID()}`; }
export function now() { return new Date().toISOString(); }
export function str(value: unknown, label: string, required = false) {
  const out = typeof value === "string" ? value.trim() : "";
  if (required && !out) throw new ApiError(400, `${label} is required.`);
  return out;
}
export function int(value: unknown, label: string, min?: number, max?: number) {
  const out = Number(value);
  if (!Number.isInteger(out) || (min != null && out < min) || (max != null && out > max)) throw new ApiError(400, `${label} is invalid.`);
  return out;
}
export function num(value: unknown, label: string, min?: number) {
  const out = Number(value);
  if (!Number.isFinite(out) || (min != null && out < min)) throw new ApiError(400, `${label} is invalid.`);
  return out;
}
export function isoDate(value: unknown, label: string) {
  const out = str(value, label, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out) || Number.isNaN(Date.parse(`${out}T00:00:00Z`))) throw new ApiError(400, `${label} must be a valid date.`);
  return out;
}
export function month(value: unknown) {
  const out = str(value, "Billing month", true);
  if (!/^\d{4}-\d{2}$/.test(out)) throw new ApiError(400, "Billing month must use YYYY-MM.");
  return out;
}
export function safeJson(value: unknown) { return value == null ? {} : value as Record<string, unknown>; }
function safeDecode(value: string) { try { return decodeURIComponent(value); } catch { return null; } }

export async function one<T = Record<string, unknown>>(stmt: D1PreparedStatement) {
  return (await stmt.first<T>()) ?? null;
}

export async function rows<T = Record<string, unknown>>(stmt: D1PreparedStatement) {
  return (await stmt.all<T>()).results;
}

export function audit(db: D1Database, owner: Owner, action: string, entityType: string, entityId: string, summary: string) {
  return db.prepare("INSERT INTO audit_log (id, owner_key, action, entity_type, entity_id, summary, actor_context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id("aud"), owner.key, action, entityType, entityId, summary.slice(0, 320), owner.email, now());
}

function defaultWorkspaceName(name: string, email: string) {
  const candidate = name === email ? email.split("@")[0] : name;
  const clean = candidate.replace(/[<>]/g, "").trim().slice(0, 80);
  return clean ? `${clean}’s workspace` : "My RentFlow workspace";
}

function runtimeBindings(): RentFlowBindings {
  return (globalThis as typeof globalThis & { __RENTFLOW_ENV__?: RentFlowBindings }).__RENTFLOW_ENV__ ?? {};
}
