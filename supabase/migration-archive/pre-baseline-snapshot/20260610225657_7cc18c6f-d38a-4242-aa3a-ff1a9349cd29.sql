GRANT SELECT, INSERT, UPDATE, DELETE ON public.kadaster_documenten TO authenticated;
GRANT ALL ON public.kadaster_documenten TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kadaster_data_records TO authenticated;
GRANT ALL ON public.kadaster_data_records TO service_role;