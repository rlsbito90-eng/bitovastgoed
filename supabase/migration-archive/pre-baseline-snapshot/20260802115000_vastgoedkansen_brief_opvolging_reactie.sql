alter table public.vastgoedkansen
  add column if not exists brief_geadresseerde text,
  add column if not exists brief_verzendwijze text,
  add column if not exists brief_verzonden_op date,
  add column if not exists brief_kenmerk text,
  add column if not exists opvolgdatum date,
  add column if not exists opvolgactie text,
  add column if not exists reactie_status text not null default 'geen_reactie',
  add column if not exists reactie_ontvangen_op date,
  add column if not exists reactie_kanaal text,
  add column if not exists reactie_samenvatting text,
  add column if not exists reactie_uitkomst text;

alter table public.vastgoedkansen drop constraint if exists vastgoedkansen_reactie_status_check;
alter table public.vastgoedkansen add constraint vastgoedkansen_reactie_status_check
check (reactie_status in ('geen_reactie','reactie_ontvangen','interesse','geen_interesse','later_contact','onbereikbaar'));
