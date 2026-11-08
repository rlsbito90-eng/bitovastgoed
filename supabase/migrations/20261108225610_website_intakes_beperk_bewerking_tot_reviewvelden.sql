-- Beperk de interne reviewbox tot status- en auditvelden.
-- Ontvangen Contact Form 7-brondata kan door browsergebruikers niet worden herschreven.
REVOKE UPDATE ON TABLE public.website_investor_intakes FROM authenticated;
GRANT UPDATE (
 status, processed_relatie_id, review_reason, reviewed_at, reviewed_by, updated_at
) ON TABLE public.website_investor_intakes TO authenticated;
