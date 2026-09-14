-- Definitieve briefinhoud blijft databasebreed immutable. De atomische
-- batch-posttransactie mag uitsluitend de operationele verzendprojectie
-- bijwerken nadat de gekoppelde immutable briefversie al als verzonden staat.

create or replace function public.off_market_bewaak_definitieve_brief_lock()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'definitief' and new is distinct from old then
    if new.status = 'verstuurd'
      and new.verzendstatus = 'gepost'
      and new.printdatum is not null
      and new.postdatum is not null
      and new.verzonden_op is not null
      and new.opvolgdatum = new.postdatum + 21
      and (
        to_jsonb(new) - array[
          'status', 'verzendstatus', 'printdatum', 'postdatum',
          'verzonden_op', 'opvolgdatum', 'updated_at'
        ]::text[]
      ) = (
        to_jsonb(old) - array[
          'status', 'verzendstatus', 'printdatum', 'postdatum',
          'verzonden_op', 'opvolgdatum', 'updated_at'
        ]::text[]
      )
      and exists (
        select 1
        from public.off_market_brief_versies bv
        join public.off_market_printbatch_brieven pb
          on pb.brief_versie_id = bv.id
         and pb.brief_id = old.id
         and pb.verwijderd_op is null
        join public.off_market_printbatches batch
          on batch.id = pb.batch_id
         and batch.status = 'geprint'
         and batch.printdatum is not null
        where bv.brief_id = old.id
          and bv.status = 'verzonden'
          and bv.verzonden_op = new.verzonden_op
      )
    then
      return new;
    end if;

    raise exception 'brief_definitief_vergrendeld';
  end if;

  return new;
end;
$$;

revoke all on function public.off_market_bewaak_definitieve_brief_lock()
from public, anon, authenticated;
