-- Bito CRM: lagere idle polling voor Off-Market Radar en BAG/energie.
-- Al toegepast in productie (Supabase migratie 20261110003435).
-- Houd notificaties/reminders op iedere minuut (deadline-nauwkeurigheid).
-- Behoud job-IDs, HTTP-opdrachten, auth headers en instellingen van de workers.
-- Met cron.alter_job blijven bestaande cronjobs volledig intact.
-- De jobs zijn idempotent; veilig bij herhaald uitvoeren.
DO $$
DECLARE
  task record;
  scheduled record;
BEGIN
  FOR task IN
    SELECT * FROM (VALUES
      ('off-market-sync-quarter-hourly', '*/15 * * * *', '0 * * * *'),
      ('off-market-geo-quarter-hourly', '*/15 * * * *', '10 * * * *'),
      ('off-market-ai-auto-quarter-hourly', '*/15 * * * *', '20 * * * *'),
      ('vastgoed-energy-auto-five-minutely', '*/5 * * * *', '5,35 * * * *'),
      ('off-market-bag-auto-five-minutely', '*/5 * * * *', '15,45 * * * *')
    ) AS schedules(name, previous, desired)
  LOOP
    SELECT cj.jobid, cj.schedule INTO scheduled
      FROM cron.job AS cj WHERE cj.jobname = task.name;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cron job missing: %', task.name;
    END IF;
    IF scheduled.schedule NOT IN (task.previous, task.desired) THEN
      RAISE EXCEPTION 'Unexpected cron schedule for %: %', task.name, scheduled.schedule;
    END IF;
  END LOOP;

  FOR task IN
    SELECT * FROM (VALUES
      ('off-market-sync-quarter-hourly', '0 * * * *'),
      ('off-market-geo-quarter-hourly', '10 * * * *'),
      ('off-market-ai-auto-quarter-hourly', '20 * * * *'),
      ('vastgoed-energy-auto-five-minutely', '5,35 * * * *'),
      ('off-market-bag-auto-five-minutely', '15,45 * * * *')
    ) AS schedules(name, desired)
  LOOP
    SELECT cj.jobid INTO scheduled
      FROM cron.job AS cj WHERE cj.jobname = task.name;
    PERFORM cron.alter_job(job_id => scheduled.jobid, schedule => task.desired);
  END LOOP;
END
$$;
