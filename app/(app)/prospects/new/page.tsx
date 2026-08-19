import { createClient } from '@/lib/supabase/server';
import { createProspectFromTemplate } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function NewProspectPage() {
  const supabase = createClient();
  const { data: templates } = await supabase
    .from('use_case_templates')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name');

  return (
    <div className="main">
      <div className="page-panel wide">
        <div className="eyebrow">New Prospect</div>
        <h1 className="panel-title">Pick a starting point</h1>
        <p className="panel-sub">
          Start from a use-case template — its process steps, risks, and roadmap are copied in and stay fully
          editable — or start blank.
        </p>

        <div className="template-grid">
          <form action={createProspectFromTemplate.bind(null, null)}>
            <button type="submit" className="template-card blank">
              <div className="tc-name">Blank prospect</div>
              <div className="tc-desc">No template — add process steps, risks, and roadmap from scratch.</div>
            </button>
          </form>
          {(templates ?? []).map((t) => (
            <form key={t.id} action={createProspectFromTemplate.bind(null, t.id)}>
              <button type="submit" className="template-card">
                {t.is_default && <span className="default-badge">Default</span>}
                <div className="tc-industry">{t.industry}</div>
                <div className="tc-name">{t.name}</div>
                <div className="tc-desc">{t.use_case_description}</div>
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
