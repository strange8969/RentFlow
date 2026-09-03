type MeterReading = { tenancy_id?: string; billing_month?: string };

export function nextAvailableReadingMonth(readings: MeterReading[], tenancyId: string, preferredMonth: string) {
  const occupiedMonths = new Set(readings.filter((reading) => reading.tenancy_id === tenancyId).map((reading) => reading.billing_month));
  let candidate = preferredMonth;

  for (let attempt = 0; attempt < 120 && occupiedMonths.has(candidate); attempt += 1) {
    const [year, month] = candidate.split("-").map(Number);
    const next = new Date(Date.UTC(year, month, 1));
    candidate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  return candidate;
}
