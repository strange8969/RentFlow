export type RentTenancy = {
  id: string;
  rent_start_date: string;
  move_out_date?: string | null;
  rent_proration_mode?: string | null;
};

export type RentRate = {
  tenancy_id: string;
  amount_paise: number;
  effective_from: string;
  effective_to?: string | null;
};

export type RentCalculation = {
  amountPaise: number;
  periodStart: string;
  periodEnd: string;
  occupiedDays: number;
  monthDays: number;
  prorated: boolean;
  note: string;
};

export function calculateMonthlyRent(tenancy: RentTenancy, allRates: RentRate[], billingMonth: string): RentCalculation | null {
  const monthStart = `${billingMonth}-01`;
  const monthEnd = endOfMonth(billingMonth);
  if (tenancy.rent_start_date > monthEnd || (tenancy.move_out_date && tenancy.move_out_date < monthStart)) return null;

  const prorated = tenancy.rent_proration_mode === "prorated";
  const periodStart = prorated && tenancy.rent_start_date > monthStart ? tenancy.rent_start_date : monthStart;
  const periodEnd = prorated && tenancy.move_out_date && tenancy.move_out_date < monthEnd ? tenancy.move_out_date : monthEnd;
  const rates = allRates.filter((rate) => rate.tenancy_id === tenancy.id).sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  if (!rates.length) return null;

  const monthDays = Number(monthEnd.slice(-2));
  let exact = 0;
  let occupiedDays = 0;
  let rateChanges = 0;
  let previousRateId = "";
  for (let cursor = periodStart; cursor <= periodEnd; cursor = addDays(cursor, 1)) {
    const rate = [...rates].reverse().find((candidate) => candidate.effective_from <= cursor && (!candidate.effective_to || candidate.effective_to >= cursor));
    if (!rate) continue;
    exact += Number(rate.amount_paise) / monthDays;
    occupiedDays += 1;
    const rateId = `${rate.effective_from}:${rate.amount_paise}`;
    if (previousRateId && previousRateId !== rateId) rateChanges += 1;
    previousRateId = rateId;
  }
  if (!occupiedDays) return null;
  const amountPaise = Math.round(exact);
  const notes = [prorated && occupiedDays < monthDays ? `Prorated for ${occupiedDays} of ${monthDays} days` : "Full-month rent", rateChanges ? `${rateChanges + 1} effective rates applied` : ""].filter(Boolean);
  return { amountPaise, periodStart, periodEnd, occupiedDays, monthDays, prorated, note: notes.join(" · ") };
}

export function endOfMonth(billingMonth: string) {
  const [year, month] = billingMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
