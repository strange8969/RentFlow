export type MonthlyCloseStatus = "draft" | "reviewed" | "closed";
export type CommunicationKind = "rent_due" | "overdue" | "payment_acknowledgement" | "renewal" | "maintenance";
export type WorkspaceRole = "owner" | "manager" | "accountant" | "read_only";

export type OperationsAction =
  | "set_monthly_close"
  | "bulk_generate_rent"
  | "bulk_finalize_electricity"
  | "save_communication_template"
  | "prepare_communication"
  | "set_communication_preference"
  | "import_bank_transactions"
  | "reconcile_bank_transaction"
  | "undo_bank_reconciliation"
  | "create_payment_request"
  | "confirm_payment_request"
  | "create_inspection"
  | "finalize_inspection"
  | "create_renewal"
  | "set_renewal_status"
  | "update_onboarding"
  | "create_workspace_invitation"
  | "revoke_workspace_invitation"
  | "accept_workspace_invitation"
  | "set_member_role"
  | "revoke_member"
  | "configure_test_plan"
  | "create_backup";

export type OperationsRequest<T = Record<string, unknown>> = {
  action: OperationsAction;
  requestKey: string;
  payload: T;
};

export type ClosingIssue = {
  key: string;
  severity: "warning" | "blocking";
  label: string;
  count: number;
  amountPaise?: number;
  explanation: string;
  actionPage: string;
};

export type BulkRowResult = {
  id: string;
  status: "successful" | "skipped" | "failed";
  message: string;
};
