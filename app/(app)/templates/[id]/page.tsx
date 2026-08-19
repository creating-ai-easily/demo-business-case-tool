import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TemplateEditor } from './template-edit-client';

export const dynamic = 'force-dynamic';

export default async function TemplateEditPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: template }, { data: steps }, { data: risks }, { data: roadmap }] = await Promise.all([
    supabase.from('use_case_templates').select('*').eq('id', params.id).single(),
    supabase.from('template_steps').select('*').eq('template_id', params.id).order('sort_order'),
    supabase.from('template_risks').select('*').eq('template_id', params.id).order('sort_order'),
    supabase.from('template_roadmap').select('*').eq('template_id', params.id).order('sort_order'),
  ]);

  if (!template) notFound();

  return (
    <TemplateEditor
      template={template}
      initialSteps={steps ?? []}
      initialRisks={risks ?? []}
      initialRoadmap={roadmap ?? []}
    />
  );
}
