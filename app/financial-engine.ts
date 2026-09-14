export type FinancialCharge = {
  id: string;
  tenancyId: string;
  type: "rent" | "electricity" | "other";
  amountPaise: number;
  dueDate: string;
  billedAt?: string | null;
};

export type FinancialPayment = {
  id: string;
  tenancyId: string;
  amountPaise: number;
  paymentDate: string;
  status: string;
};

export type FinancialAllocation = {
  id?: string;
  paymentId: string;
  chargeType: string;
  chargeId: string;
  amountPaise: number;
  createdAt?: string | null;
  reversed?: boolean | number;
  reversedAt?: string | null;
};

export function financialSnapshot(input: {
  contractualRentPaise?: number;
  charges: FinancialCharge[];
  payments: FinancialPayment[];
  allocations: FinancialAllocation[];
  issuedCreditsPaise?: number;
  appliedCreditsPaise?: number;
  depositsHeldPaise?: number;
  asOf?: string;
}) {
  const asOf = input.asOf ?? "9999-12-31T23:59:59.999Z";
  const livePayments = input.payments.filter((payment) => payment.status === "recorded" && `${payment.paymentDate}T23:59:59.999Z` <= asOf);
  const paymentIds = new Set(livePayments.map((payment) => payment.id));
  const liveAllocations = input.allocations.filter((allocation) =>
    paymentIds.has(allocation.paymentId)
    && !allocation.reversed
    && (!allocation.createdAt || allocation.createdAt <= asOf)
    && (!allocation.reversedAt || allocation.reversedAt > asOf),
  );
  const billedChargesPaise = input.charges.reduce((sum, charge) => sum + charge.amountPaise, 0);
  const cashReceivedPaise = livePayments.reduce((sum, payment) => sum + payment.amountPaise, 0);
  const allocatedPaise = liveAllocations.reduce((sum, allocation) => sum + allocation.amountPaise, 0);
  const appliedCreditsPaise = input.appliedCreditsPaise ?? 0;
  const unpaidBalancePaise = Math.max(0, billedChargesPaise - allocatedPaise - appliedCreditsPaise);
  const unappliedFundsPaise = Math.max(0, cashReceivedPaise - allocatedPaise);
  return {
    contractualRentPaise: input.contractualRentPaise ?? 0,
    billedChargesPaise,
    cashReceivedPaise,
    allocatedPaise,
    unpaidBalancePaise,
    issuedCreditsPaise: input.issuedCreditsPaise ?? 0,
    appliedCreditsPaise,
    unappliedFundsPaise,
    depositsHeldPaise: input.depositsHeldPaise ?? 0,
  };
}
