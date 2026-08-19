'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  upsertStep,
  deleteStep,
  upsertRisk,
  deleteRisk,
  upsertRoadmapPhase,
  updateProspect,
  updateProspectStatus,
  duplicateProspect,
} from '@/lib/actions';
import { computeMetrics, fmtEUR, fmtNum, fmtPct, fmtPayback } from '@/lib/calculations';
import type { ProcessStepRow, ProspectRow, ProspectStatus, RiskRow, RoadmapPhaseRow } from '@/lib/types';

const STEP_DEFS = [
  { key: 'prospect', title: 'Prospect & Use Case', desc: "Who's in the room, what we're solving" },
  { key: 'without', title: 'Without the Tool — Today', desc: 'Current effort & cost' },
  { key: 'with', title: 'With MARKT-PILOT — Target', desc: 'Effort after adoption, plus investment' },
  { key: 'compare', title: 'Before / After', desc: 'The business case, side by side' },
  { key: 'risks', title: 'Risks & Roadmap', desc: 'Objections, phased plan, summary' },
] as const;

const SAVE_DEBOUNCE_MS = 700;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/* ---------- animated count-up, mirrors the MVP artifact's animateStat ---------- */
function useAnimatedNumber(target: number, duration = 450) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  useEffect(() => {
    const from = prevRef.current;
    const to = Number.isFinite(target) ? target : 0;
    if (from === to) return;
    let raf = 0;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
        setDisplay(to);
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

interface WizardProspect {
  id: string;
  company_name: string;
  industry: string;
  contact_name: string;
  contact_email: string;
  conversation_date: string;
  use_case_title: string;
  use_case_description: string;
  hourly_rate: number;
  investment_one_time: number;
  investment_recurring: number;
  next_step: string;
  status: ProspectStatus;
}

function toWizardProspect(p: ProspectRow): WizardProspect {
  return {
    id: p.id,
    company_name: p.company_name ?? '',
    industry: p.industry ?? '',
    contact_name: p.contact_name ?? '',
    contact_email: p.contact_email ?? '',
    conversation_date: p.conversation_date ?? '',
    use_case_title: p.use_case_title ?? '',
    use_case_description: p.use_case_description ?? '',
    hourly_rate: Number(p.hourly_rate ?? 0),
    investment_one_time: Number(p.investment_one_time ?? 0),
    investment_recurring: Number(p.investment_recurring ?? 0),
    next_step: p.next_step ?? '',
    status: p.status,
  };
}

export function ProspectWizard({
  prospect: initialProspect,
  initialSteps,
  initialRisks,
  initialRoadmap,
}: {
  prospect: ProspectRow;
  initialSteps: ProcessStepRow[];
  initialRisks: RiskRow[];
  initialRoadmap: RoadmapPhaseRow[];
}) {
  const [prospect, setProspect] = useState<WizardProspect>(() => toWizardProspect(initialProspect));
  const [steps, setSteps] = useState<ProcessStepRow[]>(initialSteps);
  const [risks, setRisks] = useState<RiskRow[]>(initialRisks);
  const [roadmap, setRoadmap] = useState<RoadmapPhaseRow[]>(initialRoadmap);
  const [currentStep, setCurrentStep] = useState(0);
  const [maxStepReached, setMaxStepReached] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [qaPct, setQaPct] = useState(70);

  const prospectRef = useRef(prospect);
  useEffect(() => {
    prospectRef.current = prospect;
  }, [prospect]);

  const prospectTimer = useRef<ReturnType<typeof setTimeout>>();
  const stepTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const riskTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const roadmapTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  function markSaved(ok: boolean) {
    setSaveStatus(ok ? 'saved' : 'error');
    if (ok) setSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  }

  const scheduleProspectSave = useCallback(() => {
    setSaveStatus('saving');
    clearTimeout(prospectTimer.current);
    prospectTimer.current = setTimeout(async () => {
      const p = prospectRef.current;
      const res = await updateProspect(p.id, {
        company_name: p.company_name,
        industry: p.industry,
        contact_name: p.contact_name,
        contact_email: p.contact_email,
        conversation_date: p.conversation_date || null,
        use_case_title: p.use_case_title,
        use_case_description: p.use_case_description,
        hourly_rate: p.hourly_rate,
        investment_one_time: p.investment_one_time,
        investment_recurring: p.investment_recurring,
        next_step: p.next_step,
      });
      markSaved(res.ok);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  function updateField<K extends keyof WizardProspect>(field: K, value: WizardProspect[K]) {
    setProspect((prev) => ({ ...prev, [field]: value }));
    scheduleProspectSave();
  }

  async function changeStatus(status: ProspectStatus) {
    setProspect((prev) => ({ ...prev, status }));
    setSaveStatus('saving');
    const res = await updateProspectStatus(prospect.id, status);
    markSaved(res.ok);
  }

  function scheduleStepSave(step: ProcessStepRow) {
    setSaveStatus('saving');
    const timers = stepTimers.current;
    clearTimeout(timers.get(step.id));
    timers.set(
      step.id,
      setTimeout(async () => {
        const res = await upsertStep(prospect.id, {
          id: step.id,
          name: step.name,
          hours_without: step.hours_without,
          hours_with: step.hours_with,
          sort_order: step.sort_order,
        });
        markSaved(res.ok);
      }, SAVE_DEBOUNCE_MS)
    );
  }

  function updateStep(id: string, patch: Partial<ProcessStepRow>) {
    setSteps((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      const updated = next.find((s) => s.id === id);
      if (updated) scheduleStepSave(updated);
      return next;
    });
  }

  function addStep() {
    const newStep: ProcessStepRow = {
      id: uid(),
      prospect_id: prospect.id,
      name: 'New step',
      hours_without: 0,
      hours_with: 0,
      sort_order: steps.length,
    };
    setSteps((prev) => [...prev, newStep]);
    scheduleStepSave(newStep);
  }

  async function removeStep(id: string) {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((s) => s.id !== id));
    clearTimeout(stepTimers.current.get(id));
    setSaveStatus('saving');
    const res = await deleteStep(id);
    markSaved(res.ok);
  }

  function applyQuickApply() {
    setSteps((prev) => {
      const next = prev.map((s) => {
        const hours_with = Math.max(0, Math.round(Number(s.hours_without) * (1 - qaPct / 100) * 2) / 2);
        const updated = { ...s, hours_with };
        scheduleStepSave(updated);
        return updated;
      });
      return next;
    });
  }

  function scheduleRiskSave(risk: RiskRow) {
    setSaveStatus('saving');
    const timers = riskTimers.current;
    clearTimeout(timers.get(risk.id));
    timers.set(
      risk.id,
      setTimeout(async () => {
        const res = await upsertRisk(prospect.id, {
          id: risk.id,
          name: risk.name,
          mitigation: risk.mitigation,
          discussed: risk.discussed,
          sort_order: risk.sort_order,
        });
        markSaved(res.ok);
      }, SAVE_DEBOUNCE_MS)
    );
  }

  function updateRisk(id: string, patch: Partial<RiskRow>) {
    setRisks((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      const updated = next.find((r) => r.id === id);
      if (updated) scheduleRiskSave(updated);
      return next;
    });
  }

  function addRisk() {
    const newRisk: RiskRow = {
      id: uid(),
      prospect_id: prospect.id,
      name: 'New risk',
      mitigation: '',
      discussed: false,
      sort_order: risks.length,
    };
    setRisks((prev) => [...prev, newRisk]);
    scheduleRiskSave(newRisk);
  }

  async function removeRisk(id: string) {
    setRisks((prev) => prev.filter((r) => r.id !== id));
    clearTimeout(riskTimers.current.get(id));
    setSaveStatus('saving');
    const res = await deleteRisk(id);
    markSaved(res.ok);
  }

  function scheduleRoadmapSave(phase: RoadmapPhaseRow) {
    setSaveStatus('saving');
    const timers = roadmapTimers.current;
    clearTimeout(timers.get(phase.id));
    timers.set(
      phase.id,
      setTimeout(async () => {
        const res = await upsertRoadmapPhase(prospect.id, {
          id: phase.id,
          phase_label: phase.phase_label,
          title: phase.title,
          duration: phase.duration,
          description: phase.description,
          sort_order: phase.sort_order,
        });
        markSaved(res.ok);
      }, SAVE_DEBOUNCE_MS)
    );
  }

  function updateRoadmapPhase(id: string, patch: Partial<RoadmapPhaseRow>) {
    setRoadmap((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      const updated = next.find((p) => p.id === id);
      if (updated) scheduleRoadmapSave(updated);
      return next;
    });
  }

  function goToStep(idx: number) {
    setCurrentStep(idx);
    setMaxStepReached((prev) => Math.max(prev, idx));
  }
  useEffect(() => {
    setMaxStepReached((prev) => Math.max(prev, currentStep));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metrics = useMemo(
    () =>
      computeMetrics({
        steps: steps.map((s) => ({ hours_without: Number(s.hours_without), hours_with: Number(s.hours_with) })),
        hourlyRate: prospect.hourly_rate,
        investmentOneTime: prospect.investment_one_time,
        investmentRecurring: prospect.investment_recurring,
      }),
    [steps, prospect.hourly_rate, prospect.investment_one_time, prospect.investment_recurring]
  );

  const stepKey = STEP_DEFS[currentStep].key;

  return (
    <div className="wizard-shell">
      <aside className="sidebar">
        <div className="progress-wrap">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${((maxStepReached + 1) / STEP_DEFS.length) * 100}%` }} />
          </div>
          <div className="progress-label">
            Step {currentStep + 1} of {STEP_DEFS.length}
          </div>
        </div>
        {STEP_DEFS.map((s, i) => {
          const visited = i <= maxStepReached && i !== currentStep;
          return (
            <button
              key={s.key}
              type="button"
              className={`step-item ${i === currentStep ? 'active' : ''} ${visited ? 'visited' : ''}`}
              onClick={() => goToStep(i)}
            >
              <div className="step-num">{visited ? '✓' : String(i + 1).padStart(2, '0')}</div>
              <div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            </button>
          );
        })}
      </aside>

      <div className="main">
        <div className="step-panel">
          <div className="prospect-toolbar">
            <Link href="/" className="nav-btn secondary">
              ← Dashboard
            </Link>
            <span className="save-status">
              <span className={`save-dot ${saveStatus === 'saving' ? 'saving' : saveStatus === 'error' ? 'error' : ''}`} />
              {saveStatus === 'saving' && 'Saving…'}
              {saveStatus === 'saved' && `Saved${savedAt ? ` · ${savedAt}` : ''}`}
              {saveStatus === 'error' && 'Save failed'}
              {saveStatus === 'idle' && 'Ready'}
            </span>
            <select value={prospect.status} onChange={(e) => changeStatus(e.target.value as ProspectStatus)}>
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
            <form action={duplicateProspect.bind(null, prospect.id)}>
              <button type="submit" className="nav-btn secondary">
                Duplicate
              </button>
            </form>
          </div>

          <LiveBar step={currentStep} metrics={metrics} />

          <div className="step-content">
            {stepKey === 'prospect' && <StepProspect prospect={prospect} onChange={updateField} />}
            {stepKey === 'without' && (
              <StepWithout prospect={prospect} steps={steps} metrics={metrics} onChangeField={updateField}
                onUpdateStep={updateStep} onAddStep={addStep} onRemoveStep={removeStep} />
            )}
            {stepKey === 'with' && (
              <StepWith prospect={prospect} steps={steps} metrics={metrics} qaPct={qaPct} setQaPct={setQaPct}
                onApplyQuickApply={applyQuickApply} onUpdateStep={updateStep} onChangeField={updateField} />
            )}
            {stepKey === 'compare' && <StepCompare steps={steps} metrics={metrics} />}
            {stepKey === 'risks' && (
              <StepRisks
                prospect={prospect}
                risks={risks}
                roadmap={roadmap}
                metrics={metrics}
                onChangeField={updateField}
                onUpdateRisk={updateRisk}
                onAddRisk={addRisk}
                onRemoveRisk={removeRisk}
                onUpdateRoadmap={updateRoadmapPhase}
              />
            )}

            <div className="step-nav">
              <button className="nav-btn secondary" disabled={currentStep === 0} onClick={() => goToStep(Math.max(0, currentStep - 1))}>
                ← Back
              </button>
              <button
                className="nav-btn primary"
                disabled={currentStep === STEP_DEFS.length - 1}
                onClick={() => goToStep(Math.min(STEP_DEFS.length - 1, currentStep + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ Live bar */
function LiveBar({ step, metrics }: { step: number; metrics: ReturnType<typeof computeMetrics> }) {
  const hours = useAnimatedNumber(metrics.hoursSavedYear);
  const savings = useAnimatedNumber(metrics.savingsYear);
  const roi = useAnimatedNumber(metrics.roi3y);

  if (step === 0) {
    return (
      <div className="live-bar">
        <span className="live-bar-empty">Your business case will build up here as you go — start with the prospect basics →</span>
      </div>
    );
  }
  return (
    <div className="live-bar">
      <div className="live-bar-item">
        <span className="lb-label">Time saved / yr</span>
        <span className="lb-value">{fmtNum(hours, 0)} hrs</span>
      </div>
      <div className="live-bar-item">
        <span className="lb-label">Cost savings / yr</span>
        <span className="lb-value gold">{fmtEUR(savings)}</span>
      </div>
      <div className="live-bar-item">
        <span className="lb-label">3-yr ROI</span>
        <span className="lb-value">{fmtPct(roi)}</span>
      </div>
      <div className="live-bar-item">
        <span className="lb-label">Payback</span>
        <span className="lb-value">{fmtPayback(metrics.paybackMonths)}</span>
      </div>
    </div>
  );
}

/* ============================================================ Step 1 */
function StepProspect({
  prospect,
  onChange,
}: {
  prospect: WizardProspect;
  onChange: <K extends keyof WizardProspect>(field: K, value: WizardProspect[K]) => void;
}) {
  return (
    <>
      <div className="eyebrow">Step 01</div>
      <h1 className="panel-title">Prospect & Use Case</h1>
      <p className="panel-sub">Set the frame for the conversation: who&apos;s in the room, and which concrete use case you&apos;ll walk through together.</p>
      <div className="card">
        <div className="card-title">Prospect</div>
        <div className="field-grid">
          <div className="field">
            <label>Company</label>
            <input type="text" value={prospect.company_name} onChange={(e) => onChange('company_name', e.target.value)} placeholder="e.g. Acme Manufacturing" />
          </div>
          <div className="field">
            <label>Industry</label>
            <input type="text" value={prospect.industry} onChange={(e) => onChange('industry', e.target.value)} placeholder="e.g. Machine Manufacturing" />
          </div>
          <div className="field">
            <label>Contact</label>
            <input type="text" value={prospect.contact_name} onChange={(e) => onChange('contact_name', e.target.value)} placeholder="Name, role" />
          </div>
          <div className="field">
            <label>Contact email</label>
            <input type="email" value={prospect.contact_email} onChange={(e) => onChange('contact_email', e.target.value)} placeholder="name@company.com" />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={prospect.conversation_date} onChange={(e) => onChange('conversation_date', e.target.value)} />
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Use case</div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Title</label>
          <input type="text" value={prospect.use_case_title} onChange={(e) => onChange('use_case_title', e.target.value)} />
        </div>
        <div className="field">
          <label>Short description</label>
          <textarea value={prospect.use_case_description} onChange={(e) => onChange('use_case_description', e.target.value)} />
        </div>
      </div>
    </>
  );
}

/* ============================================================ Step 2 */
function StepWithout({
  prospect,
  steps,
  metrics,
  onChangeField,
  onUpdateStep,
  onAddStep,
  onRemoveStep,
}: {
  prospect: WizardProspect;
  steps: ProcessStepRow[];
  metrics: ReturnType<typeof computeMetrics>;
  onChangeField: <K extends keyof WizardProspect>(field: K, value: WizardProspect[K]) => void;
  onUpdateStep: (id: string, patch: Partial<ProcessStepRow>) => void;
  onAddStep: () => void;
  onRemoveStep: (id: string) => void;
}) {
  return (
    <>
      <div className="eyebrow">Step 02</div>
      <h1 className="panel-title">Without the Tool — Today</h1>
      <p className="panel-sub">How does {prospect.use_case_title || 'this process'} run today? Map the process steps, weekly time spent, and average hourly cost.</p>
      <div className="card">
        <div className="card-title">Baseline rate</div>
        <div className="field" style={{ maxWidth: 220 }}>
          <label>Average hourly rate (blended roles)</label>
          <input type="number" min={0} step={1} value={prospect.hourly_rate} onChange={(e) => onChangeField('hourly_rate', Number(e.target.value))} />
        </div>
        <span className="placeholder-note">Placeholder value — adjust to the prospect&apos;s real cost base</span>
      </div>
      <div className="card">
        <div className="card-title">Process steps today</div>
        <div className="col-headers">
          <div className="col-label">Step</div>
          <div className="col-label">Hrs / week</div>
          <div></div>
        </div>
        <div className="steps-table">
          {steps.map((st) => (
            <div className="steps-row" key={st.id}>
              <input type="text" value={st.name} onChange={(e) => onUpdateStep(st.id, { name: e.target.value })} />
              <input type="number" min={0} step={0.5} value={st.hours_without} onChange={(e) => onUpdateStep(st.id, { hours_without: Number(e.target.value) })} />
              <button className="remove-row" aria-label="Remove step" onClick={() => onRemoveStep(st.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button className="add-row-btn" onClick={onAddStep}>
          + Add step
        </button>
      </div>
      <div className="card">
        <div className="card-title">Current-state summary</div>
        <div className="summary-strip">
          <div className="summary-stat">
            <div className="label">Total effort / week</div>
            <div className="value brick">{fmtNum(metrics.totalHoursWithout)} hrs/wk</div>
          </div>
          <div className="summary-stat">
            <div className="label">Cost / year</div>
            <div className="value brick">{fmtEUR(metrics.costWithoutYear)}</div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================ Step 3 */
function StepWith({
  prospect,
  steps,
  metrics,
  qaPct,
  setQaPct,
  onApplyQuickApply,
  onUpdateStep,
  onChangeField,
}: {
  prospect: WizardProspect;
  steps: ProcessStepRow[];
  metrics: ReturnType<typeof computeMetrics>;
  qaPct: number;
  setQaPct: (v: number) => void;
  onApplyQuickApply: () => void;
  onUpdateStep: (id: string, patch: Partial<ProcessStepRow>) => void;
  onChangeField: <K extends keyof WizardProspect>(field: K, value: WizardProspect[K]) => void;
}) {
  return (
    <>
      <div className="eyebrow">Step 03</div>
      <h1 className="panel-title">With MARKT-PILOT — Target State</h1>
      <p className="panel-sub">Same steps — how does effort change with PRICERADAR & PRICEGUIDE? Plus the investment required.</p>
      <div className="card">
        <div className="card-title">Process steps with tool</div>
        <div className="quick-apply">
          <label>Quick apply: cut time by</label>
          <input type="range" min={0} max={100} step={5} value={qaPct} onChange={(e) => setQaPct(Number(e.target.value))} />
          <span className="qa-pct">{qaPct}%</span>
          <button onClick={onApplyQuickApply}>Apply to all steps</button>
        </div>
        <div className="col-headers two-col">
          <div className="col-label">Step</div>
          <div className="col-label">Baseline hrs/wk</div>
          <div className="col-label">With tool hrs/wk</div>
          <div></div>
        </div>
        <div className="steps-table">
          {steps.map((st) => {
            const warn = Number(st.hours_with) > Number(st.hours_without);
            return (
              <div className="steps-row two-col" key={st.id}>
                <input type="text" value={st.name} onChange={(e) => onUpdateStep(st.id, { name: e.target.value })} />
                <input type="number" value={st.hours_without} disabled style={{ opacity: 0.5 }} />
                <input type="number" min={0} step={0.5} value={st.hours_with} onChange={(e) => onUpdateStep(st.id, { hours_with: Number(e.target.value) })} />
                <span />
                {warn && <div className="row-warning">⚠ Time with tool exceeds the baseline — double-check this row</div>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <div className="card-title">Investment</div>
        <div className="field-grid">
          <div className="field">
            <label>One-time setup (€)</label>
            <input type="number" min={0} step={500} value={prospect.investment_one_time} onChange={(e) => onChangeField('investment_one_time', Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Ongoing costs / year (€)</label>
            <input type="number" min={0} step={500} value={prospect.investment_recurring} onChange={(e) => onChangeField('investment_recurring', Number(e.target.value))} />
          </div>
        </div>
        <span className="placeholder-note">Placeholder values — MARKT-PILOT pricing is individual, confirm before the real conversation</span>
      </div>
      <div className="card">
        <div className="card-title">Target-state summary</div>
        <div className="summary-strip">
          <div className="summary-stat">
            <div className="label">Total effort / week</div>
            <div className="value">{fmtNum(metrics.totalHoursWith)} hrs/wk</div>
          </div>
          <div className="summary-stat">
            <div className="label">Cost / year</div>
            <div className="value">{fmtEUR(metrics.costWithYear)}</div>
          </div>
          <div className="summary-stat">
            <div className="label">Time saved / week</div>
            <div className="value gold">{fmtNum(metrics.hoursSavedWeek)} hrs/wk</div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================ Step 4 */
function StepCompare({ steps, metrics }: { steps: ProcessStepRow[]; metrics: ReturnType<typeof computeMetrics> }) {
  const heroHours = useAnimatedNumber(metrics.hoursSavedYear);
  const heroSavings = useAnimatedNumber(metrics.savingsYear);
  const heroRoi = useAnimatedNumber(metrics.roi3y);

  const maxH = Math.max(1, ...steps.map((s) => Math.max(Number(s.hours_without || 0), Number(s.hours_with || 0))));
  const maxHours = Math.max(metrics.totalHoursWithout, metrics.totalHoursWith, 1);
  const maxCost = Math.max(metrics.costWithoutYear, metrics.costWithYear, 1);

  return (
    <>
      <div className="eyebrow">Step 04</div>
      <h1 className="panel-title">Before / After</h1>
      <p className="panel-sub">The business case in direct comparison — process by process, then the full picture.</p>
      <div className="card">
        <div className="card-title">Process comparison</div>
        {steps.map((st) => {
          const withoutPct = Math.min(100, (Number(st.hours_without || 0) / maxH) * 100);
          const withPct = Math.min(100, (Number(st.hours_with || 0) / maxH) * 100);
          const delta = Number(st.hours_without || 0) - Number(st.hours_with || 0);
          return (
            <div className="cmp-row" key={st.id}>
              <div className="cmp-name">{st.name}</div>
              <div>
                <div className="cmp-bar-track">
                  <div className="cmp-bar-fill without" style={{ width: `${withoutPct}%` }} />
                </div>
                <span className="cmp-val">{fmtNum(st.hours_without)} hrs/wk</span>
              </div>
              <div className="cmp-arrow">→</div>
              <div>
                <div className="cmp-bar-track">
                  <div className="cmp-bar-fill with" style={{ width: `${withPct}%` }} />
                </div>
                <span className="cmp-val">{fmtNum(st.hours_with)} hrs/wk</span>
              </div>
              <div className="cmp-delta">−{fmtNum(delta)} hrs</div>
            </div>
          );
        })}
      </div>
      <div className="card">
        <div className="card-title">Total effort & cost</div>
        <div className="agg-compare">
          <div className="agg-block">
            <div className="agg-label">Hrs / week</div>
            <AggBar label="Without tool" value={metrics.totalHoursWithout} max={maxHours} kind="without" text={`${fmtNum(metrics.totalHoursWithout)} hrs/wk`} />
            <AggBar label="With tool" value={metrics.totalHoursWith} max={maxHours} kind="with" text={`${fmtNum(metrics.totalHoursWith)} hrs/wk`} />
          </div>
          <div className="agg-block">
            <div className="agg-label">Cost / year</div>
            <AggBar label="Without tool" value={metrics.costWithoutYear} max={maxCost} kind="without" text={fmtEUR(metrics.costWithoutYear)} />
            <AggBar label="With tool" value={metrics.costWithYear} max={maxCost} kind="with" text={fmtEUR(metrics.costWithYear)} />
          </div>
        </div>
      </div>
      <div className="hero-stats">
        <div className="hero-stat">
          <div className="hs-label">Time saved / year</div>
          <div className="hs-value">
            {fmtNum(heroHours, 0)}
            <span className="hs-unit">hrs</span>
          </div>
        </div>
        <div className="hero-stat">
          <div className="hs-label">Cost savings / year</div>
          <div className="hs-value">{fmtEUR(heroSavings)}</div>
        </div>
        <div className="hero-stat">
          <div className="hs-label">Payback period</div>
          <div className="hs-value">{fmtPayback(metrics.paybackMonths)}</div>
        </div>
        <div className="hero-stat">
          <div className="hs-label">3-year ROI</div>
          <div className="hs-value">{fmtPct(heroRoi)}</div>
        </div>
      </div>
    </>
  );
}

function AggBar({ value, max, kind, text, label }: { value: number; max: number; kind: 'with' | 'without'; text: string; label: string }) {
  const pct = Math.max(6, Math.min(100, (value / max) * 100));
  return (
    <div className="agg-bar-row">
      <div className="agg-bar-name">{label}</div>
      <div className="agg-bar-track">
        <div className={`agg-bar-fill ${kind}`} style={{ width: `${pct}%` }}>
          {text}
        </div>
      </div>
    </div>
  );
}

/* ============================================================ Step 5 */
function StepRisks({
  prospect,
  risks,
  roadmap,
  metrics,
  onChangeField,
  onUpdateRisk,
  onAddRisk,
  onRemoveRisk,
  onUpdateRoadmap,
}: {
  prospect: WizardProspect;
  risks: RiskRow[];
  roadmap: RoadmapPhaseRow[];
  metrics: ReturnType<typeof computeMetrics>;
  onChangeField: <K extends keyof WizardProspect>(field: K, value: WizardProspect[K]) => void;
  onUpdateRisk: (id: string, patch: Partial<RiskRow>) => void;
  onAddRisk: () => void;
  onRemoveRisk: (id: string) => void;
  onUpdateRoadmap: (id: string, patch: Partial<RoadmapPhaseRow>) => void;
}) {
  const closingSavings = useAnimatedNumber(metrics.savingsYear);
  const closingRoi = useAnimatedNumber(metrics.roi3y);
  const [copied, setCopied] = useState(false);
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  const summaryText = useMemo(() => {
    const paybackText = metrics.paybackMonths !== null ? `${fmtNum(metrics.paybackMonths, 1)} months` : 'n/a';
    return [
      `Business Case — ${prospect.company_name || '(prospect)'}`,
      `Use case: ${prospect.use_case_title}`,
      `Industry: ${prospect.industry}`,
      ``,
      `Without tool: ${fmtNum(metrics.totalHoursWithout)} hrs/week · ${fmtEUR(metrics.costWithoutYear)}/year`,
      `With MARKT-PILOT: ${fmtNum(metrics.totalHoursWith)} hrs/week · ${fmtEUR(metrics.costWithYear)}/year`,
      ``,
      `Time saved: ${fmtNum(metrics.hoursSavedYear, 0)} hrs/year`,
      `Cost savings: ${fmtEUR(metrics.savingsYear)}/year`,
      `Payback: ${paybackText}`,
      `3-year ROI: ${fmtPct(metrics.roi3y)}`,
      ``,
      `Next step: ${prospect.next_step}`,
    ].join('\n');
  }, [prospect, metrics]);

  async function onCopySummary() {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard api');
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setFallbackVisible(false);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setFallbackVisible(true);
      requestAnimationFrame(() => {
        fallbackRef.current?.focus();
        fallbackRef.current?.select();
      });
    }
  }

  return (
    <>
      <div className="eyebrow">Step 05</div>
      <h1 className="panel-title">Risks & Roadmap</h1>
      <p className="panel-sub">Address the typical objections openly, then sketch the path to implementation.</p>
      <div className="card">
        <div className="card-title">Risks to discuss</div>
        {risks.map((r) => (
          <div className="risk-item" key={r.id}>
            <input type="checkbox" checked={r.discussed} onChange={(e) => onUpdateRisk(r.id, { discussed: e.target.checked })} aria-label="Discussed" />
            <div className="risk-body">
              <input type="text" className="risk-name" value={r.name} onChange={(e) => onUpdateRisk(r.id, { name: e.target.value })} />
              <textarea className="risk-mit" value={r.mitigation ?? ''} onChange={(e) => onUpdateRisk(r.id, { mitigation: e.target.value })} />
            </div>
            <button className="remove-row" aria-label="Remove risk" onClick={() => onRemoveRisk(r.id)}>
              ×
            </button>
          </div>
        ))}
        <button className="add-row-btn" onClick={onAddRisk}>
          + Add risk
        </button>
      </div>
      <div className="card">
        <div className="card-title">Roadmap</div>
        <div className="roadmap-grid">
          {roadmap.map((p) => (
            <div className="roadmap-card" key={p.id}>
              <div className="roadmap-phase">{p.phase_label}</div>
              <input type="text" className="rm-title" value={p.title ?? ''} onChange={(e) => onUpdateRoadmap(p.id, { title: e.target.value })} />
              <input type="text" className="rm-duration" value={p.duration ?? ''} onChange={(e) => onUpdateRoadmap(p.id, { duration: e.target.value })} />
              <textarea className="rm-desc" value={p.description ?? ''} onChange={(e) => onUpdateRoadmap(p.id, { description: e.target.value })} />
            </div>
          ))}
        </div>
      </div>
      <div className="closing-strip">
        <div className="eyebrow">Summary</div>
        <h2>Business case for {prospect.company_name || 'the prospect'}</h2>
        <div className="closing-stats">
          <div className="closing-stat">
            <div className="cs-label">Cost savings / year</div>
            <div className="cs-value">{fmtEUR(closingSavings)}</div>
          </div>
          <div className="closing-stat">
            <div className="cs-label">3-year ROI</div>
            <div className="cs-value">{fmtPct(closingRoi)}</div>
          </div>
          <div className="closing-stat">
            <div className="cs-label">Payback</div>
            <div className="cs-value">{fmtPayback(metrics.paybackMonths)}</div>
          </div>
        </div>
        <div className="next-step-field">
          <label>Next step</label>
          <input type="text" value={prospect.next_step} onChange={(e) => onChangeField('next_step', e.target.value)} placeholder="e.g. Schedule pilot kickoff" />
        </div>
        <button className="btn-on-navy" onClick={onCopySummary}>
          {copied ? 'Copied ✓' : 'Copy summary'}
        </button>
        <textarea ref={fallbackRef} className={`summary-fallback ${fallbackVisible ? 'visible' : ''}`} readOnly value={summaryText} />
        <div className={`fallback-note ${fallbackVisible ? 'visible' : ''}`}>
          Clipboard access was blocked — the text above is selected, copy it manually (Ctrl/Cmd+C).
        </div>
      </div>
    </>
  );
}
