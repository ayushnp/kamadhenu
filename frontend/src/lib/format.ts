import type { Cow, HealthRecord, Vaccination } from '../api/types';

export const cowLabel = (c: Cow) =>
  c.name || (c.tag_number ? `Tag ${c.tag_number}` : null) || (c.pashu_aadhar ? `Pashu Aadhar ${c.pashu_aadhar}` : null) || 'Unnamed animal';

export const cowSubtitle = (c: Cow, t?: (key: string, params?: any) => string) => {
  const speciesLabel = t
    ? c.species === 'buffalo'
      ? t('home.speciesBuffalo')
      : t('home.speciesCattle')
    : c.species;
  const ageLabel = c.age_years != null
    ? t
      ? t('home.ageYr', { age: c.age_years })
      : `${c.age_years} yr`
    : null;
  return [c.breed, speciesLabel, ageLabel].filter(Boolean).join(' · ');
};

/** Today as YYYY-MM-DD — the format FastAPI's `date` fields expect. */
export const today = () => new Date().toISOString().slice(0, 10);

export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function prettyDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function daysUntil(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

/** Open health records (no resolved_date) are what a vet needs to see first. */
export const openConditions = (records: HealthRecord[]) => records.filter((r) => !r.resolved_date);

export function nextDue(vaxes: Vaccination[]): Vaccination | null {
  const upcoming = vaxes.filter((v) => v.next_due_date).sort((a, b) => a.next_due_date!.localeCompare(b.next_due_date!));
  return upcoming[0] ?? null;
}
