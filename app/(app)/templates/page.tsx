import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createTemplate } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const supabase = createClient();
  const { data: templates } = await supabase
    .from('use_case_templates')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name');

  return (
    <div className="main">
      <div className="page-panel wide">
        <div className="eyebrow">Templates</div>
        <h1 className="panel-title">Use-case templates</h1>
        <p className="panel-sub">
          Templates seed a new prospect&apos;s process steps, risks, and roadmap. Add a new offer here without
          touching code — editing a prospect afterward never changes the template it came from.
        </p>

        <div className="card">
          <div className="card-title">New template</div>
          <form action={createTemplate}>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" name="name" type="text" required placeholder="e.g. MARKT-PILOT — Warranty Claims" />
              </div>
              <div className="field">
                <label htmlFor="industry">Industry</label>
                <input id="industry" name="industry" type="text" placeholder="e.g. Machine Manufacturing" />
              </div>
              <div className="field">
                <label htmlFor="use_case_title">Use case title</label>
                <input id="use_case_title" name="use_case_title" type="text" required />
              </div>
              <div className="field">
                <label htmlFor="default_hourly_rate">Default hourly rate (€)</label>
                <input id="default_hourly_rate" name="default_hourly_rate" type="number" min={0} step={1} defaultValue={55} />
              </div>
              <div className="field">
                <label htmlFor="default_investment_one_time">Default one-time investment (€)</label>
                <input id="default_investment_one_time" name="default_investment_one_time" type="number" min={0} step={500} defaultValue={0} />
              </div>
              <div className="field">
                <label htmlFor="default_investment_recurring">Default recurring investment (€/yr)</label>
                <input id="default_investment_recurring" name="default_investment_recurring" type="number" min={0} step={500} defaultValue={0} />
              </div>
            </div>
            <div className="field" style={{ marginTop: 16, marginBottom: 16 }}>
              <label htmlFor="use_case_description">Use case description</label>
              <textarea id="use_case_description" name="use_case_description" />
            </div>
            <button type="submit" className="nav-btn primary">
              Create template
            </button>
          </form>
        </div>

        <div className="template-grid">
          {(templates ?? []).map((t) => (
            <Link key={t.id} href={`/templates/${t.id}`} className="template-card">
              {t.is_default && <span className="default-badge">Default</span>}
              <div className="tc-industry">{t.industry}</div>
              <div className="tc-name">{t.name}</div>
              <div className="tc-desc">{t.use_case_description}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
