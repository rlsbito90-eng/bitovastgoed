-- Notificatie-/taaktriggers zijn uitsluitend interne databasefuncties.
-- Ze hoeven niet via PostgREST RPC aanroepbaar te zijn.

revoke all on function public.set_taak_owner_user() from public;
revoke all on function public.set_taak_owner_user() from anon;
revoke all on function public.set_taak_owner_user() from authenticated;

revoke all on function public.sync_deal_followup_task() from public;
revoke all on function public.sync_deal_followup_task() from anon;
revoke all on function public.sync_deal_followup_task() from authenticated;

revoke all on function public.sync_pipeline_next_action_task() from public;
revoke all on function public.sync_pipeline_next_action_task() from anon;
revoke all on function public.sync_pipeline_next_action_task() from authenticated;

revoke all on function public.sync_vastgoedkans_next_action_task() from public;
revoke all on function public.sync_vastgoedkans_next_action_task() from anon;
revoke all on function public.sync_vastgoedkans_next_action_task() from authenticated;
