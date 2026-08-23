-- Deze functies zijn uitsluitend intern bedoeld: profielafleiding en de BEFORE INSERT-trigger.
-- PostgREST hoeft ze niet als RPC beschikbaar te maken.
revoke all on function public.off_market_assign_copy_variant_v1() from public, anon, authenticated;
revoke all on function public.acquisitie_copy_profiel_v1(uuid) from public, anon, authenticated;
