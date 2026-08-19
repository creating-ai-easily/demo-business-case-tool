import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { computeMetrics, fmtEUR, fmtPct, fmtPayback } from '@/lib/calculations';
import type { ProcessStepRow, ProspectStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUS_FILTERS: { key: ProspectStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = createClient();
  const activeStatus = (['open', 'won', 'lost'].includes(searchParams.status ?? '')
    ? searchParams.status
    : 'all') as ProspectStatus | 'all';

  let query = supabase.from('prospects').select('*').order('updated_at', { ascending: false });
  if (activeStatus !== 'all') query = query.eq('status', activeStatus);
  const { data: prospects } = await query;

  const ids = (prospects ?? []).map((p) => p.id);
  let allSteps: ProcessStepRow[] = [];
  if (ids.length) {
    const { data } = await supabase.from('process_steps').select('*').in('prospect_id', ids);
    allSteps = data ?? [];
  }
  const stepsByProspect = new Map<string, ProcessStepRow[]>();
  allSteps.forEach((s) => {
    const list = stepsByProspect.get(s.prospect_id) ?? [];
    list.push(s);
    stepsByProspect.set(s.prospect_id, list);
  });

  return (
    <div className="main">
      <div className="page-panel wide">
        <div className="panel-header-row">
          <div>
            <div className="eyebrow">Dashboard</div>
            <h1 className="panel-title">Prospects</h1>
            <p className="panel-sub">Every in-progress and closed business case, sorted by most recently updated.</p>
          </div>
          <Link href="/prospects/new" className="nav-btn primary">
            + New Prospect
          </Link>
        </div>

        <div className="status-filter">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === 'all' ? '/' : `/?status=${f.key}`}
              className={activeStatus === f.key ? 'active' : ''}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {!prospects?.length ? (
          <div className="empty-state">
            No prospects{activeStatus !== 'all' ? ` with status "${activeStatus}"` : ' yet'}.{' '}
            <Link href="/prospects/new">Start a business case →</Link>
          </div>
        ) : (
          <div className="prospect-grid">
            {prospects.map((p) => {
              const steps = stepsByProspect.get(p.id) ?? [];
              const m = computeMetrics({
                steps: steps.map((s) => ({ hours_without: s.hours_without, hours_with: s.hours_with })),
                hourlyRate: p.hourly_rate,
                investmentOneTime: p.investment_one_time,
                investmentRecurring: p.investment_recurring,
              });
              return (
                <Link key={p.id} href={`/prospects/${p.id}`} className="prospect-card">
                  <div className="prospect-main">
                    <div className="prospect-company">{p.company_name || '(unnamed prospect)'}</div>
                    <div className="prospect-usecase">{p.use_case_title || 'No use case set yet'}</div>
                  </div>
                  <div className="prospect-meta">
                    <div className="prospect-stat">
                      <div className="label">Savings/yr</div>
                      <div className="value">{fmtEUR(m.savingsYear)}</div>
                    </div>
                    <div className="prospect-stat">
                      <div className="label">3-yr ROI</div>
                      <div className="value">{fmtPct(m.roi3y)}</div>
                    </div>
                    <div className="prospect-stat">
                      <div className="label">Payback</div>
                      <div className="value">{fmtPayback(m.paybackMonths)}</div>
                    </div>
                    <span className={`status-badge ${p.status}`}>{p.status}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
