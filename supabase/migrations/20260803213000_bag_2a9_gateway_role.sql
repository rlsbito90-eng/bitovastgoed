-- BAG BUILD 2A.9 — minimale transportidentiteit voor server-side BAG-query's.
-- Het account krijgt bewust geen wachtwoord in migratiecode. Credentialprovisioning
-- is een afzonderlijke, handmatige secretoperatie en mag nooit in Git belanden.

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'bag_gateway') THEN
    CREATE ROLE bag_gateway
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
      NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 8;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'bag_gateway'
      AND rolcanlogin
      AND NOT rolsuper
      AND NOT rolcreatedb
      AND NOT rolcreaterole
      AND NOT rolinherit
      AND NOT rolreplication
      AND NOT rolbypassrls
      AND rolconnlimit = 8
  ) THEN
    RAISE EXCEPTION 'bag_gateway heeft niet het verwachte minimale rolcontract';
  END IF;
END
$role$;

REVOKE ALL ON SCHEMA bag_control, bag_staging, bag_published, bag_service
  FROM bag_gateway;
REVOKE ALL ON ALL TABLES IN SCHEMA bag_control, bag_staging, bag_published
  FROM bag_gateway;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA bag_control, bag_staging, bag_published
  FROM bag_gateway;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bag_control, bag_service
  FROM bag_gateway;

-- De login moet per transactie expliciet SET LOCAL ROLE bag_reader uitvoeren.
-- Daardoor heeft een vergeten SET ROLE geen toegang en blijft de auditgrens helder.
GRANT bag_reader TO bag_gateway
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;

COMMENT ON ROLE bag_gateway IS
  'Shadow-only servertransportlogin; geen direct BAG-recht, uitsluitend SET ROLE bag_reader.';
