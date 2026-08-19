'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type {
  ProspectRow,
  ProspectStatus,
  ProcessStepRow,
  RiskRow,
  RoadmapPhaseRow,
  TemplateStepRow,
  TemplateRiskRow,
  TemplateRoadmapRow,
  UseCaseTemplateRow,
} from '@/lib/types';

type ActionResult = { ok: true } | { ok: false; error: string };

// ── Prospects ────────────────────────────────────────────────

export async function createProspectFromTemplate(templateId: string | null) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let template: UseCaseTemplateRow | null = null;
  let steps: TemplateStepRow[] = [];
  let risks: TemplateRiskRow[] = [];
  let roadmap: TemplateRoadmapRow[] = [];

  if (templateId) {
    const [{ data: t }, { data: s }, { data: r }, { data: rm }] = await Promise.all([
      supabase.from('use_case_templates').select('*').eq('id', templateId).single(),
      supabase.from('template_steps').select('*').eq('template_id', templateId).order('sort_order'),
      supabase.from('template_risks').select('*').eq('template_id', templateId).order('sort_order'),
      supabase.from('template_roadmap').select('*').eq('template_id', templateId).order('sort_order'),
    ]);
    template = t;
    steps = s ?? [];
    risks = r ?? [];
    roadmap = rm ?? [];
  }

  const { data: prospect, error } = await supabase
    .from('prospects')
    .insert({
      owner_id: user.id,
      template_id: templateId,
      company_name: '',
      industry: template?.industry ?? null,
      use_case_title: template?.use_case_title ?? '',
      use_case_description: template?.use_case_description ?? '',
      hourly_rate: template?.default_hourly_rate ?? 0,
      investment_one_time: template?.default_investment_one_time ?? 0,
      investment_recurring: template?.default_investment_recurring ?? 0,
      next_step: '',
      status: 'open',
    })
    .select()
    .single();

  if (error || !prospect) {
    throw new Error(error?.message ?? 'Failed to create prospect');
  }

  if (steps.length) {
    await supabase.from('process_steps').insert(
      steps.map((s) => ({
        prospect_id: prospect.id,
        name: s.name,
        hours_without: s.hours_without,
        hours_with: s.hours_with,
        sort_order: s.sort_order,
      }))
    );
  }
  if (risks.length) {
    await supabase.from('risks').insert(
      risks.map((r) => ({
        prospect_id: prospect.id,
        name: r.name,
        mitigation: r.mitigation,
        discussed: false,
        sort_order: r.sort_order,
      }))
    );
  }
  if (roadmap.length) {
    await supabase.from('roadmap_phases').insert(
      roadmap.map((rm) => ({
        prospect_id: prospect.id,
        phase_label: rm.phase_label,
        title: rm.title,
        duration: rm.duration,
        description: rm.description,
        sort_order: rm.sort_order,
      }))
    );
  }

  revalidatePath('/');
  redirect(`/prospects/${prospect.id}`);
}

export async function duplicateProspect(sourceProspectId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: source }, { data: steps }, { data: risks }, { data: roadmap }] = await Promise.all([
    supabase.from('prospects').select('*').eq('id', sourceProspectId).single(),
    supabase.from('process_steps').select('*').eq('prospect_id', sourceProspectId).order('sort_order'),
    supabase.from('risks').select('*').eq('prospect_id', sourceProspectId).order('sort_order'),
    supabase.from('roadmap_phases').select('*').eq('prospect_id', sourceProspectId).order('sort_order'),
  ]);

  if (!source) throw new Error('Prospect not found');

  const { data: prospect, error } = await supabase
    .from('prospects')
    .insert({
      owner_id: user.id,
      template_id: source.template_id,
      company_name: source.company_name ? `${source.company_name} (copy)` : '',
      industry: source.industry,
      contact_name: source.contact_name,
      contact_email: source.contact_email,
      use_case_title: source.use_case_title,
      use_case_description: source.use_case_description,
      hourly_rate: source.hourly_rate,
      investment_one_time: source.investment_one_time,
      investment_recurring: source.investment_recurring,
      next_step: source.next_step,
      status: 'open',
    })
    .select()
    .single();

  if (error || !prospect) throw new Error(error?.message ?? 'Failed to duplicate prospect');

  if (steps?.length) {
    await supabase.from('process_steps').insert(
      steps.map((s) => ({
        prospect_id: prospect.id,
        name: s.name,
        hours_without: s.hours_without,
        hours_with: s.hours_with,
        sort_order: s.sort_order,
      }))
    );
  }
  if (risks?.length) {
    await supabase.from('risks').insert(
      risks.map((r) => ({
        prospect_id: prospect.id,
        name: r.name,
        mitigation: r.mitigation,
        discussed: false,
        sort_order: r.sort_order,
      }))
    );
  }
  if (roadmap?.length) {
    await supabase.from('roadmap_phases').insert(
      roadmap.map((rm) => ({
        prospect_id: prospect.id,
        phase_label: rm.phase_label,
        title: rm.title,
        duration: rm.duration,
        description: rm.description,
        sort_order: rm.sort_order,
      }))
    );
  }

  revalidatePath('/');
  redirect(`/prospects/${prospect.id}`);
}

export async function updateProspect(
  prospectId: string,
  patch: Partial<
    Pick<
      ProspectRow,
      | 'company_name'
      | 'industry'
      | 'contact_name'
      | 'contact_email'
      | 'use_case_title'
      | 'use_case_description'
      | 'hourly_rate'
      | 'investment_one_time'
      | 'investment_recurring'
      | 'next_step'
      | 'notion_page_id'
    >
  > & { conversation_date?: string | null }
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('prospects').update(patch).eq('id', prospectId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateProspectStatus(prospectId: string, status: ProspectStatus): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('prospects').update({ status }).eq('id', prospectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}

// ── Process steps ────────────────────────────────────────────

export async function upsertStep(
  prospectId: string,
  step: Pick<ProcessStepRow, 'id' | 'name' | 'hours_without' | 'hours_with' | 'sort_order'>
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('process_steps').upsert({ ...step, prospect_id: prospectId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteStep(stepId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('process_steps').delete().eq('id', stepId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Risks ────────────────────────────────────────────────────

export async function upsertRisk(
  prospectId: string,
  risk: Pick<RiskRow, 'id' | 'name' | 'mitigation' | 'discussed' | 'sort_order'>
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('risks').upsert({ ...risk, prospect_id: prospectId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteRisk(riskId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('risks').delete().eq('id', riskId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Roadmap ──────────────────────────────────────────────────

export async function upsertRoadmapPhase(
  prospectId: string,
  phase: Pick<RoadmapPhaseRow, 'id' | 'phase_label' | 'title' | 'duration' | 'description' | 'sort_order'>
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('roadmap_phases').upsert({ ...phase, prospect_id: prospectId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Templates ────────────────────────────────────────────────

export async function createTemplate(formData: FormData) {
  const supabase = createClient();
  const input = {
    name: String(formData.get('name') || ''),
    industry: String(formData.get('industry') || ''),
    use_case_title: String(formData.get('use_case_title') || ''),
    use_case_description: String(formData.get('use_case_description') || ''),
    default_hourly_rate: Number(formData.get('default_hourly_rate') || 0),
    default_investment_one_time: Number(formData.get('default_investment_one_time') || 0),
    default_investment_recurring: Number(formData.get('default_investment_recurring') || 0),
  };
  const { data, error } = await supabase.from('use_case_templates').insert(input).select().single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to create template');
  revalidatePath('/templates');
  redirect(`/templates/${data.id}`);
}

export async function updateTemplate(
  templateId: string,
  patch: Partial<
    Pick<
      UseCaseTemplateRow,
      | 'name'
      | 'industry'
      | 'use_case_title'
      | 'use_case_description'
      | 'default_hourly_rate'
      | 'default_investment_one_time'
      | 'default_investment_recurring'
      | 'is_default'
    >
  >
): Promise<ActionResult> {
  const supabase = createClient();

  if (patch.is_default) {
    await supabase.from('use_case_templates').update({ is_default: false }).neq('id', templateId);
  }

  const { error } = await supabase.from('use_case_templates').update(patch).eq('id', templateId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/templates');
  revalidatePath(`/templates/${templateId}`);
  return { ok: true };
}

export async function upsertTemplateStep(
  templateId: string,
  step: Pick<TemplateStepRow, 'id' | 'name' | 'hours_without' | 'hours_with' | 'sort_order'>
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('template_steps').upsert({ ...step, template_id: templateId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteTemplateStep(stepId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('template_steps').delete().eq('id', stepId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function upsertTemplateRisk(
  templateId: string,
  risk: Pick<TemplateRiskRow, 'id' | 'name' | 'mitigation' | 'sort_order'>
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('template_risks').upsert({ ...risk, template_id: templateId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteTemplateRisk(riskId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('template_risks').delete().eq('id', riskId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function upsertTemplateRoadmapPhase(
  templateId: string,
  phase: Pick<TemplateRoadmapRow, 'id' | 'phase_label' | 'title' | 'duration' | 'description' | 'sort_order'>
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('template_roadmap').upsert({ ...phase, template_id: templateId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteTemplateRoadmapPhase(phaseId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('template_roadmap').delete().eq('id', phaseId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
