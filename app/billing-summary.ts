type Charge = { id?: string; amount_paise?: number } | null | undefined;
type ElectricityBill = { id?: string; total_paise?: number } | null | undefined;

type CombinedBillInput = {
  rentCharge: Charge;
  electricityBill: ElectricityBill;
  otherCharges: Charge[];
  previousOutstanding: number;
  allocationsByCharge: Record<string, number>;
};

export function combinedBillSummary({ rentCharge, electricityBill, otherCharges, previousOutstanding, allocationsByCharge }: CombinedBillInput) {
  const rent = Number(rentCharge?.amount_paise || 0);
  const electricity = Number(electricityBill?.total_paise || 0);
  const other = otherCharges.reduce((sum, charge) => sum + Number(charge?.amount_paise || 0), 0);
  const paid = (rentCharge?.id ? Number(allocationsByCharge[`rent:${rentCharge.id}`] || 0) : 0)
    + (electricityBill?.id ? Number(allocationsByCharge[`electricity:${electricityBill.id}`] || 0) : 0)
    + otherCharges.reduce((sum, charge) => sum + (charge?.id ? Number(allocationsByCharge[`other:${charge.id}`] || 0) : 0), 0);
  const total = rent + electricity + previousOutstanding + other;

  return { rent, electricity, other, paid, total, balance: Math.max(0, total - paid) };
}
