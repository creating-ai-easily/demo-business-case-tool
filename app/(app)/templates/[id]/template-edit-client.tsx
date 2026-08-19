'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  updateTemplate,
  upsertTemplateStep,
  deleteTemplateStep,
  upsertTemplateRisk,
  deleteTemplateRisk,
  upsertTemplateRoadmapPhase,
} from '@/lib/actions';
import type { TemplateRiskRow, TemplateRoadmapRow, TemplateStepRow, UseCaseTemplateRow } from '@/lib/types';

const SAVE_DEBOUNCE_MS = 700;

function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface WizardTemplate {
  id: string;
  name: string;
  industry: string;
  use_case_title: string;
  use_case_description: string;
  default_hourly_rate: number;
  default_investment_one_time: number;
  default_investment_recurring: number;
  is_default: boolean;
}

function toWizardTemplate(t: UseCaseTemplateRow): WizardTemplate {
  return {
    id: t.id,
    name: t.name,
    industry: t.industry ?? '',
    use_case_title: t.use_case_title,
    use_case_description: t.use_case_description ?? '',
    default_hourly_rate: Number(t.default_hourly_rate ?? 0),
    default_investment_one_time: Number(t.default_investment_one_time ?? 0),
    default_investment_recurring: Number(t.default_investment_recurring ?? 0),
    is_default: t.is_default,
  };
}

export function TemplateEditor({
  template: initialTemplate,
  initialSteps,
  initialRisks,
  initialRoadmap,
}: {
  template: UseCaseTemplateRow;
  initialSteps: TemplateStepRow[];
  initialRisks: TemplateRiskRow[];
  initialRoadmap: TemplateRoadmapRow[];
}) {
  const [template, setTemplate] = useState<WizardTemplate>(() => toWizardTemplate(initialTemplate));
  const [steps, setSteps] = useState<TemplateStepRow[]>(initialSteps);
  const [risks, setRisks] = useState<TemplateRiskRow[]>(initialRisks);
  const [roadmap, setRoadmap] = useState<TemplateRoadmapRow[]>(initialRoadmap);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const templateRef = useRef(template);
  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  const templateTimer = useRef<ReturnType<typeof setTimeout>>();
  const stepTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const riskTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const roadmapTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  function markSaved(ok: boolean) {
    setSaveStatus(ok ? 'saved' : 'error');
    if (ok) setSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  }

  function scheduleTemplateSave() {
    setSaveStatus('saving');
    clearTimeout(templateTimer.current);
    templateTimer.current = setTimeout(async () => {
      const t = templateRef.current;
      const res = await updateTemplate(t.id, {
        name: t.name,
        industry: t.industry,
        use_case_title: t.use_case_title,
        use_case_description: t.use_case_description,
        default_hourly_rate: t.default_hourly_rate,
        default_investment_one_time: t.default_investment_one_time,
        default_investment_recurring: t.default_investment_recurring,
      });
      markSaved(res.ok);
    }, SAVE_DEBOUNCE_MS);
  }

  function updateField<K extends keyof WizardTemplate>(field: K, value: WizardTemplate[K]) {
    setTemplate((prev) => ({ ...prev, [field]: value }));
    scheduleTemplateSave();
  }

  async function toggleDefault(checked: boolean) {
    setTemplate((prev) => ({ ...prev, is_default: checked }));
    setSaveStatus('saving');
    const res = await updateTemplate(template.id, { is_default: checked });
    markSaved(res.ok);
  }

  function scheduleStepSave(step: TemplateStepRow) {
    setSaveStatus('saving');
    const timers = stepTimers.current;
    clearTimeout(timers.get(step.id));
    timers.set(
      step.id,
      setTimeout(async () => {
        const res = await upsertTemplateStep(template.id, {
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

  function updateStep(id: string, patch: Partial<TemplateStepRow>) {
    setSteps((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      const updated = next.find((s) => s.id === id);
      if (updated) scheduleStepSave(updated);
      return next;
    });
  }

  function addStep() {
    const newStep: TemplateStepRow = { id: uid(), template_id: template.id, name: 'New step', hours_without: 0, hours_with: 0, sort_order: steps.length };
    setSteps((prev) => [...prev, newStep]);
    scheduleStepSave(newStep);
  }

  async function removeStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    clearTimeout(stepTimers.current.get(id));
    setSaveStatus('saving');
    const res = await deleteTemplateStep(id);
    markSaved(res.ok);
  }

  function scheduleRiskSave(risk: TemplateRiskRow) {
    setSaveStatus('saving');
    const timers = riskTimers.current;
    clearTimeout(timers.get(risk.id));
    timers.set(
      risk.id,
      setTimeout(async () => {
        const res = await upsertTemplateRisk(template.id, { id: risk.id, name: risk.name, mitigation: risk.mitigation, sort_order: risk.sort_order });
        markSaved(res.ok);
      }, SAVE_DEBOUNCE_MS)
    );
  }

  function updateRisk(id: string, patch: Partial<TemplateRiskRow>) {
    setRisks((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      const updated = next.find((r) => r.id === id);
      if (updated) scheduleRiskSave(updated);
      return next;
    });
  }

  function addRisk() {
    const newRisk: TemplateRiskRow = { id: uid(), template_id: template.id, name: 'New risk', mitigation: '', sort_order: risks.length };
    setRisks((prev) => [...prev, newRisk]);
    scheduleRiskSave(newRisk);
  }

  async function removeRisk(id: string) {
    setRisks((prev) => prev.filter((r) => r.id !== id));
    clearTimeout(riskTimers.current.get(id));
    setSaveStatus('saving');
    const res = await deleteTemplateRisk(id);
    markSaved(res.ok);
  }

  function scheduleRoadmapSave(phase: TemplateRoadmapRow) {
    setSaveStatus('saving');
    const timers = roadmapTimers.current;
    clearTimeout(timers.get(phase.id));
    timers.set(
      phase.id,
      setTimeout(async () => {
        const res = await upsertTemplateRoadmapPhase(template.id, {
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

  function updateRoadmapPhase(id: string, patch: Partial<TemplateRoadmapRow>) {
    setRoadmap((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      const updated = next.find((p) => p.id === id);
      if (updated) scheduleRoadmapSave(updated);
      return next;
    });
  }

  function addRoadmapPhase() {
    const newPhase: TemplateRoadmapRow = {
      id: uid(),
      template_id: template.id,
      phase_label: `Phase ${roadmap.length + 1}`,
      title: '',
      duration: '',
      description: '',
      sort_order: roadmap.length,
    };
    setRoadmap((prev) => [...prev, newPhase]);
    scheduleRoadmapSave(newPhase);
  }

  return (
    <div className="main">
      <div className="page-panel wide">
        <div className="prospect-toolbar">
          <Link href="/templates" className="nav-btn secondary">
            ← Templates
          </Link>
          <span className="save-status">
            <span className={`save-dot ${saveStatus === 'saving' ? 'saving' : saveStatus === 'error' ? 'error' : ''}`} />
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && `Saved${savedAt ? ` · ${savedAt}` : ''}`}
            {saveStatus === 'error' && 'Save failed'}
            {saveStatus === 'idle' && 'Ready'}
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8rem', fontWeight: 600, color: 'var(--navy)' }}>
            <input type="checkbox" checked={template.is_default} onChange={(e) => toggleDefault(e.target.checked)} />
            Default template for new prospects
          </label>
        </div>

        <div className="eyebrow">Template</div>
        <h1 className="panel-title">{template.name || 'Untitled template'}</h1>
        <p className="panel-sub">Edit the seed content copied into every new prospect that starts from this template. Existing prospects are never affected.</p>

        <div className="card">
          <div className="card-title">Template basics</div>
          <div className="field-grid">
            <div className="field">
              <label>Name</label>
              <input type="text" value={template.name} onChange={(e) => updateField('name', e.target.value)} />
            </div>
            <div className="field">
              <label>Industry</label>
              <input type="text" value={template.industry} onChange={(e) => updateField('industry', e.target.value)} />
            </div>
            <div className="field">
              <label>Use case title</label>
              <input type="text" value={template.use_case_title} onChange={(e) => updateField('use_case_title', e.target.value)} />
            </div>
            <div className="field">
              <label>Default hourly rate (€)</label>
              <input type="number" min={0} step={1} value={template.default_hourly_rate} onChange={(e) => updateField('default_hourly_rate', Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Default one-time investment (€)</label>
              <input type="number" min={0} step={500} value={template.default_investment_one_time} onChange={(e) => updateField('default_investment_one_time', Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Default recurring investment (€/yr)</label>
              <input type="number" min={0} step={500} value={template.default_investment_recurring} onChange={(e) => updateField('default_investment_recurring', Number(e.target.value))} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label>Use case description</label>
            <textarea value={template.use_case_description} onChange={(e) => updateField('use_case_description', e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="card-title">Process steps</div>
          <div className="col-headers two-col">
            <div className="col-label">Step</div>
            <div className="col-label">Hrs/wk without</div>
            <div className="col-label">Hrs/wk with</div>
            <div></div>
          </div>
          <div className="steps-table">
            {steps.map((st) => (
              <div className="steps-row two-col" key={st.id}>
                <input type="text" value={st.name} onChange={(e) => updateStep(st.id, { name: e.target.value })} />
                <input type="number" min={0} step={0.5} value={st.hours_without} onChange={(e) => updateStep(st.id, { hours_without: Number(e.target.value) })} />
                <input type="number" min={0} step={0.5} value={st.hours_with} onChange={(e) => updateStep(st.id, { hours_with: Number(e.target.value) })} />
                <button className="remove-row" aria-label="Remove step" onClick={() => removeStep(st.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <button className="add-row-btn" onClick={addStep}>
            + Add step
          </button>
        </div>

        <div className="card">
          <div className="card-title">Risks</div>
          {risks.map((r) => (
            <div className="risk-item" key={r.id}>
              <div className="risk-body">
                <input type="text" className="risk-name" value={r.name} onChange={(e) => updateRisk(r.id, { name: e.target.value })} />
                <textarea className="risk-mit" value={r.mitigation ?? ''} onChange={(e) => updateRisk(r.id, { mitigation: e.target.value })} />
              </div>
              <button className="remove-row" aria-label="Remove risk" onClick={() => removeRisk(r.id)}>
                ×
              </button>
            </div>
          ))}
          <button className="add-row-btn" onClick={addRisk}>
            + Add risk
          </button>
        </div>

        <div className="card">
          <div className="card-title">Roadmap</div>
          <div className="roadmap-grid">
            {roadmap.map((p) => (
              <div className="roadmap-card" key={p.id}>
                <input
                  type="text"
                  className="rm-duration"
                  style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--brick)' }}
                  value={p.phase_label ?? ''}
                  onChange={(e) => updateRoadmapPhase(p.id, { phase_label: e.target.value })}
                />
                <input type="text" className="rm-title" value={p.title ?? ''} onChange={(e) => updateRoadmapPhase(p.id, { title: e.target.value })} />
                <input type="text" className="rm-duration" value={p.duration ?? ''} onChange={(e) => updateRoadmapPhase(p.id, { duration: e.target.value })} />
                <textarea className="rm-desc" value={p.description ?? ''} onChange={(e) => updateRoadmapPhase(p.id, { description: e.target.value })} />
              </div>
            ))}
          </div>
          <button className="add-row-btn" onClick={addRoadmapPhase}>
            + Add phase
          </button>
        </div>
      </div>
    </div>
  );
}
