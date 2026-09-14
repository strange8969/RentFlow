export type WorkspaceRole = "owner" | "manager" | "accountant" | "read_only";

export type Permission =
  | "workspace.manage"
  | "members.manage"
  | "records.write"
  | "finance.write"
  | "expenses.write"
  | "communications.write"
  | "exports.read"
  | "period.review"
  | "period.close"
  | "period.reopen"
  | "refunds.write"
  | "security.manage"
  | "records.erase";

const matrix: Record<WorkspaceRole, ReadonlySet<Permission>> = {
  owner: new Set([
    "workspace.manage", "members.manage", "records.write", "finance.write", "expenses.write",
    "communications.write", "exports.read", "period.review", "period.close", "period.reopen",
    "refunds.write", "security.manage", "records.erase",
  ]),
  manager: new Set([
    "records.write", "finance.write", "expenses.write", "communications.write", "exports.read",
    "period.review", "period.close",
  ]),
  accountant: new Set([
    "finance.write", "expenses.write", "communications.write", "exports.read", "period.review",
  ]),
  read_only: new Set(["exports.read"]),
};

export function hasPermission(role: WorkspaceRole, permission: Permission) {
  return matrix[role]?.has(permission) ?? false;
}

export const rolePermissions = Object.fromEntries(
  Object.entries(matrix).map(([role, permissions]) => [role, [...permissions]]),
) as Record<WorkspaceRole, Permission[]>;
