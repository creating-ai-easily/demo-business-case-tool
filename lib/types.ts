// Hand-written to match supabase/migrations/0001_init.sql. If the schema
// changes, update this alongside the migration — there's no `supabase gen
// types` step in this project's build (no live CLI link at scaffold time).

export type ProspectStatus = 'open' | 'won' | 'lost';

export interface UseCaseTemplateRow {
  id: string;
  name: string;
  industry: string | null;
  use_case_title: string;
  use_case_description: string | null;
  default_hourly_rate: number;
  default_investment_one_time: number;
  default_investment_recurring: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateStepRow {
  id: string;
  template_id: string;
  name: string;
  hours_without: number;
  hours_with: number;
  sort_order: number;
}

export interface TemplateRiskRow {
  id: string;
  template_id: string;
  name: string;
  mitigation: string | null;
  sort_order: number;
}

export interface TemplateRoadmapRow {
  id: string;
  template_id: string;
  phase_label: string | null;
  title: string | null;
  duration: string | null;
  description: string | null;
  sort_order: number;
}

export interface ProspectRow {
  id: string;
  owner_id: string;
  template_id: string | null;
  company_name: string | null;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  conversation_date: string;
  use_case_title: string | null;
  use_case_description: string | null;
  hourly_rate: number;
  investment_one_time: number;
  investment_recurring: number;
  next_step: string | null;
  status: ProspectStatus;
  notion_page_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessStepRow {
  id: string;
  prospect_id: string;
  name: string;
  hours_without: number;
  hours_with: number;
  sort_order: number;
}

export interface RiskRow {
  id: string;
  prospect_id: string;
  name: string;
  mitigation: string | null;
  discussed: boolean;
  sort_order: number;
}

export interface RoadmapPhaseRow {
  id: string;
  prospect_id: string;
  phase_label: string | null;
  title: string | null;
  duration: string | null;
  description: string | null;
  sort_order: number;
}

export interface ProspectWithChildren extends ProspectRow {
  process_steps: ProcessStepRow[];
  risks: RiskRow[];
  roadmap_phases: RoadmapPhaseRow[];
}

export interface TemplateWithChildren extends UseCaseTemplateRow {
  template_steps: TemplateStepRow[];
  template_risks: TemplateRiskRow[];
  template_roadmap: TemplateRoadmapRow[];
}

