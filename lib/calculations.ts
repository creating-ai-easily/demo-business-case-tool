// Single source of truth for every ROI number shown in the app — the
// wizard, the dashboard, and the copy-summary text all call this. Formulas
// per Production Spec §5 (identical to the MVP artifact's calculations).

export interface CalcStepInput {
  hours_without: number;
  hours_with: number;
}

export interface CalcInput {
  steps: CalcStepInput[];
  hourlyRate: number;
  investmentOneTime: number;
  investmentRecurring: number;
}

export interface CalcResult {
  totalHoursWithout: number;
  totalHoursWith: number;
  hoursSavedWeek: number;
  hoursSavedYear: number;
  costWithoutYear: number;
  costWithYear: number;
  savingsYear: number;
  totalCost3y: number;
  totalSavings3y: number;
  roi3y: number;
  paybackMonths: number | null;
}

export function computeMetrics(input: CalcInput): CalcResult {
  const totalHoursWithout = input.steps.reduce((sum, s) => sum + Number(s.hours_without || 0), 0);
  const totalHoursWith = input.steps.reduce((sum, s) => sum + Number(s.hours_with || 0), 0);
  const hoursSavedWeek = totalHoursWithout - totalHoursWith;
  const hoursSavedYear = hoursSavedWeek * 52;

  const rate = Number(input.hourlyRate || 0);
  const costWithoutYear = totalHoursWithout * rate * 52;
  const costWithYear = totalHoursWith * rate * 52;
  const savingsYear = costWithoutYear - costWithYear;

  const oneTime = Number(input.investmentOneTime || 0);
  const recurring = Number(input.investmentRecurring || 0);
  const totalCost3y = oneTime + recurring * 3;
  const totalSavings3y = savingsYear * 3;
  const roi3y = totalCost3y > 0 ? ((totalSavings3y - totalCost3y) / totalCost3y) * 100 : 0;

  const monthlyNet = (savingsYear - recurring) / 12;
  const paybackMonths = monthlyNet > 0 ? oneTime / monthlyNet : null;

  return {
    totalHoursWithout,
    totalHoursWith,
    hoursSavedWeek,
    hoursSavedYear,
    costWithoutYear,
    costWithYear,
    savingsYear,
    totalCost3y,
    totalSavings3y,
    roi3y,
    paybackMonths,
  };
}

export function fmtEUR(v: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
}
export function fmtNum(v: number, dec = 1): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: dec, minimumFractionDigits: 0 }).format(v || 0);
}
export function fmtPct(v: number): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(v || 0) + '%';
}
export function fmtPayback(months: number | null): string {
  return months !== null ? `${fmtNum(months, 1)} mo` : '—';
}
