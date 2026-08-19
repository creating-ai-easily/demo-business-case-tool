-- Seeds the MARKT-PILOT use-case template with the same defaults the MVP
-- artifact shipped with (legacy/business-case-builder-mvp.html). Run once,
-- after 0001_init.sql, against the "Business Use Case Tool" project.
-- Idempotent: safe to re-run (skips if a default template already exists).

do $$
declare
  v_template_id uuid;
begin
  if exists (select 1 from use_case_templates where is_default = true) then
    raise notice 'A default template already exists — skipping seed.';
    return;
  end if;

  insert into use_case_templates (
    name, industry, use_case_title, use_case_description,
    default_hourly_rate, default_investment_one_time, default_investment_recurring,
    is_default
  ) values (
    'MARKT-PILOT — Spare Parts Pricing',
    'Machine Manufacturing',
    'Spare Parts Pricing in Machine Manufacturing',
    'Manual market price research and pricing decisions for the spare parts business, automated and data-driven with MARKT-PILOT (PRICERADAR + PRICEGUIDE) — no ERP integration required, fully web-based.',
    55, 8000, 15000,
    true
  ) returning id into v_template_id;

  insert into template_steps (template_id, name, hours_without, hours_with, sort_order) values
    (v_template_id, 'Competitor price research', 8, 0.5, 0),
    (v_template_id, 'Maintain & update price lists', 6, 1, 1),
    (v_template_id, 'Pricing decisions & calculation', 4, 2, 2),
    (v_template_id, 'Implement price changes', 3, 1, 3),
    (v_template_id, 'Reporting & monitoring', 3, 0.5, 4);

  insert into template_risks (template_id, name, mitigation, sort_order) values
    (v_template_id, 'Sales team buy-in', 'Start with a pilot on one product segment to create visible quick wins', 0),
    (v_template_id, 'Master data quality', 'MARKT-PILOT requires no ERP integration by default — you can start without an IT project', 1),
    (v_template_id, 'Internal capacity for rollout', 'Guided onboarding, with clear ownership defined in phase 1', 2);

  insert into template_roadmap (template_id, phase_label, title, duration, description, sort_order) values
    (v_template_id, 'Phase 1', 'Pilot', '4–6 weeks', 'Select one product segment, review PRICERADAR data, test first price recommendations', 0),
    (v_template_id, 'Phase 2', 'Rollout', '2–3 months', 'Expand to further product groups, train the team, adjust processes', 1),
    (v_template_id, 'Phase 3', 'Scale', 'ongoing', 'Full pricing strategy, continuous monitoring, reporting to leadership', 2);
end $$;
