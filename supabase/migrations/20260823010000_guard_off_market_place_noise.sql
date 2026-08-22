-- Bewaak alleen bewezen import-ruis in off_market_signalen.plaats.
-- Legitieme plaatsen (zoals Udenhout, Hoek, Dieren) worden niet geraakt.
-- Bij sterke bekende ruis wordt teruggevallen op de gemeente uit de gekoppelde bronconfig.

create or replace function public.off_market_guard_plaats_import_noise()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bron_gemeente text;
  p text;
begin
  p := btrim(coalesce(new.plaats, ''));
  if p = '' or new.bron_id is null then
    return new;
  end if;

  if p ~* '(^|[[:space:]])(vormen|omzetten|bouwkundig|splitsing)([[:space:]]|$)'
     or p ~* '^Z20[0-9]{2}([/-]|$)'
     or length(p) > 80 then
    select nullif(btrim(config->>'gemeente'), '')
      into bron_gemeente
    from public.off_market_bronnen
    where id = new.bron_id;

    if bron_gemeente is not null then
      new.plaats := bron_gemeente;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_off_market_guard_plaats_import_noise on public.off_market_signalen;
create trigger trg_off_market_guard_plaats_import_noise
before insert or update of plaats, bron_id on public.off_market_signalen
for each row execute function public.off_market_guard_plaats_import_noise();
