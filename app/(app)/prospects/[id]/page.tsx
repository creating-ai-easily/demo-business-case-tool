import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProspectWizard } from './wizard-client';

export const dynamic = 'force-dynamic';

export default async function ProspectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: prospect }, { data: steps }, { data: risks }, { data: roadmap }] = await Promise.all([
    supabase.from('prospects').select('*').eq('id', params.id).single(),
    supabase.from('process_steps').select('*').eq('prospect_id', params.id).order('sort_order'),
    supabase.from('risks').select('*').eq('prospect_id', params.id).order('sort_order'),
    supabase.from('roadmap_phases').select('*').eq('prospect_id', params.id).order('sort_order'),
  ]);

  if (!prospect) notFound();

  return (
    <ProspectWizard
      prospect={prospect}
      initialSteps={steps ?? []}
      initialRisks={risks ?? []}
      initialRoadmap={roadmap ?? []}
    />
  );
}
