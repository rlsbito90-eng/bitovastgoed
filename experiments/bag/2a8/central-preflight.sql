\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

WITH
bag_schemas AS (
  SELECT n.oid, n.nspname
  FROM pg_catalog.pg_namespace AS n
  WHERE n.nspname IN ('bag_control', 'bag_staging', 'bag_published', 'bag_service')
),
bag_tables AS (
  SELECT c.oid, n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_catalog.pg_class AS c
  JOIN bag_schemas AS n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p')
),
app_roles(rolnaam) AS (
  VALUES ('anon'::name), ('authenticated'::name), ('service_role'::name)
),
required_functions(signature) AS (
  VALUES
    ('bag_control.activeer_datasetversie(bigint)'),
    ('bag_control.rollback_datasetversie(bigint,bigint)'),
    ('bag_service.panden_in_viewport(text,double precision,double precision,double precision,double precision,integer)'),
    ('bag_service.zoek_panden(text,text,integer)')
),
bag_rows AS (
  SELECT
    (SELECT count(*) FROM bag_control.datasetversies)
      + (SELECT count(*) FROM bag_control.geometrie_afwijkingen)
      + (SELECT count(*) FROM bag_staging.objecten)
      + (SELECT count(*) FROM bag_staging.voorkomens)
      + (SELECT count(*) FROM bag_staging.relaties)
      + (SELECT count(*) FROM bag_staging.geometrieen)
      + (SELECT count(*) FROM bag_published.objecten)
      + (SELECT count(*) FROM bag_published.voorkomens)
      + (SELECT count(*) FROM bag_published.relaties)
      + (SELECT count(*) FROM bag_published.geometrieen) AS aantal
),
active_scope AS (
  SELECT d.id
  FROM bag_control.datasetversies AS d
  WHERE d.scope_code = :'scope_code'
    AND d.status = 'actief'
    AND d.is_actief
),
active_parity AS (
  SELECT count(*) AS failures
  FROM active_scope AS a
  WHERE (SELECT count(*) FROM bag_staging.objecten WHERE datasetversie_id = a.id) = 0
     OR (SELECT count(*) FROM bag_staging.voorkomens WHERE datasetversie_id = a.id) = 0
     OR (SELECT count(*) FROM bag_staging.objecten WHERE datasetversie_id = a.id)
          <> (SELECT count(*) FROM bag_published.objecten WHERE datasetversie_id = a.id)
     OR (SELECT count(*) FROM bag_staging.voorkomens WHERE datasetversie_id = a.id)
          <> (SELECT count(*) FROM bag_published.voorkomens WHERE datasetversie_id = a.id)
     OR (SELECT count(*) FROM bag_staging.relaties WHERE datasetversie_id = a.id)
          <> (SELECT count(*) FROM bag_published.relaties WHERE datasetversie_id = a.id)
     OR (SELECT count(*) FROM bag_staging.geometrieen WHERE datasetversie_id = a.id)
          <> (SELECT count(*) FROM bag_published.geometrieen WHERE datasetversie_id = a.id)
),
checks AS (
  SELECT 'schema_contract' AS check_name,
    (SELECT count(*) = 4 FROM bag_schemas AS s
      JOIN pg_catalog.pg_roles AS o ON o.oid = (SELECT nspowner FROM pg_catalog.pg_namespace WHERE oid = s.oid)
      WHERE o.rolname = 'postgres') AS passed,
    (SELECT count(*)::text FROM bag_schemas AS s
      JOIN pg_catalog.pg_roles AS o ON o.oid = (SELECT nspowner FROM pg_catalog.pg_namespace WHERE oid = s.oid)
      WHERE o.rolname = 'postgres') AS actual,
    '4 private BAG schemas owned by postgres' AS expected
  UNION ALL
  SELECT 'table_contract',
    (SELECT count(*) = 10 FROM bag_tables),
    (SELECT count(*)::text FROM bag_tables),
    '10 BAG tables'
  UNION ALL
  SELECT 'forced_rls',
    (SELECT count(*) = 10 FROM bag_tables WHERE relrowsecurity AND relforcerowsecurity),
    (SELECT count(*)::text FROM bag_tables WHERE relrowsecurity AND relforcerowsecurity),
    '10 tables with enabled and forced RLS'
  UNION ALL
  SELECT 'policy_contract',
    (SELECT count(*) = 27 FROM pg_catalog.pg_policy AS p JOIN bag_tables AS t ON t.oid = p.polrelid),
    (SELECT count(*)::text FROM pg_catalog.pg_policy AS p JOIN bag_tables AS t ON t.oid = p.polrelid),
    '27 explicit BAG policies'
  UNION ALL
  SELECT 'safe_roles',
    (SELECT count(*) = 3 FROM pg_catalog.pg_roles WHERE rolname IN ('bag_loader', 'bag_publisher', 'bag_reader')
      AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls),
    (SELECT count(*)::text FROM pg_catalog.pg_roles WHERE rolname IN ('bag_loader', 'bag_publisher', 'bag_reader')
      AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls),
    '3 NOLOGIN/NOINHERIT/NOBYPASSRLS roles'
  UNION ALL
  SELECT 'gateway_role_hardening',
    (SELECT count(*) = 1
      FROM pg_catalog.pg_roles AS r
      JOIN pg_catalog.pg_authid AS a ON a.oid = r.oid
      WHERE r.rolname = 'bag_gateway'
        AND r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole
        AND NOT r.rolinherit AND NOT r.rolreplication AND NOT r.rolbypassrls
        AND r.rolconnlimit = 8
        AND CASE :'expectation'
          WHEN 'clean-shadow' THEN a.rolpassword IS NULL
          WHEN 'active-dataset' THEN a.rolpassword IS NOT NULL
          ELSE false
        END),
    COALESCE((SELECT 'login=' || r.rolcanlogin::text
      || ',connlimit=' || r.rolconnlimit::text
      || ',credential=' || (a.rolpassword IS NOT NULL)::text
      FROM pg_catalog.pg_roles AS r
      JOIN pg_catalog.pg_authid AS a ON a.oid = r.oid
      WHERE r.rolname = 'bag_gateway'), 'missing'),
    CASE :'expectation'
      WHEN 'clean-shadow' THEN 'minimal login, connection limit 8, no credential'
      WHEN 'active-dataset' THEN 'minimal login, connection limit 8, credential configured'
      ELSE 'known expectation'
    END
  UNION ALL
  SELECT 'postgis_contract',
    EXISTS (
      SELECT 1 FROM pg_catalog.pg_extension AS e
      JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
      WHERE e.extname = 'postgis' AND n.nspname = 'extensions'
    ) AND (
      SELECT count(*) = 3
      FROM pg_catalog.pg_namespace AS n
      CROSS JOIN (VALUES ('bag_loader'), ('bag_publisher'), ('bag_reader')) AS r(rolnaam)
      WHERE n.nspname = 'extensions'
        AND pg_catalog.has_schema_privilege(r.rolnaam, n.oid, 'USAGE')
    ),
    COALESCE((SELECT n.nspname || ':' || e.extversion FROM pg_catalog.pg_extension AS e
      JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace WHERE e.extname = 'postgis'), 'missing'),
    'PostGIS in extensions; USAGE for 3 BAG roles'
  UNION ALL
  SELECT 'index_contract',
    (SELECT count(*) = 4
      FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_index AS i ON i.indexrelid = c.oid
      WHERE c.relname IN (
        'bag_datasetversies_een_actief_per_scope_idx',
        'bag_staging_geometrieen_gist_idx',
        'bag_published_geometrieen_gist_idx',
        'bag_published_geometrieen_object_idx'
      ) AND i.indisvalid AND i.indisready),
    (SELECT count(*)::text FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_index AS i ON i.indexrelid = c.oid
      WHERE c.relname IN (
        'bag_datasetversies_een_actief_per_scope_idx',
        'bag_staging_geometrieen_gist_idx',
        'bag_published_geometrieen_gist_idx',
        'bag_published_geometrieen_object_idx'
      ) AND i.indisvalid AND i.indisready),
    '4 required valid and ready indexes'
  UNION ALL
  SELECT 'function_contract',
    (SELECT count(*) = 4 FROM required_functions WHERE pg_catalog.to_regprocedure(signature) IS NOT NULL),
    (SELECT count(*)::text FROM required_functions WHERE pg_catalog.to_regprocedure(signature) IS NOT NULL),
    '4 version/query functions'
  UNION ALL
  SELECT 'version_function_hardening',
    (SELECT count(*) = 2
      FROM pg_catalog.pg_proc AS p
      JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
      JOIN pg_catalog.pg_roles AS o ON o.oid = p.proowner
      WHERE n.nspname = 'bag_control'
        AND p.proname IN ('activeer_datasetversie', 'rollback_datasetversie')
        AND NOT p.prosecdef AND o.rolname = 'postgres'
        AND EXISTS (SELECT 1 FROM unnest(p.proconfig) AS cfg WHERE cfg LIKE 'search_path=%')),
    (SELECT count(*)::text
      FROM pg_catalog.pg_proc AS p
      JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
      JOIN pg_catalog.pg_roles AS o ON o.oid = p.proowner
      WHERE n.nspname = 'bag_control'
        AND p.proname IN ('activeer_datasetversie', 'rollback_datasetversie')
        AND NOT p.prosecdef AND o.rolname = 'postgres'
        AND EXISTS (SELECT 1 FROM unnest(p.proconfig) AS cfg WHERE cfg LIKE 'search_path=%')),
    '2 SECURITY INVOKER version functions owned by postgres with fixed search_path'
  UNION ALL
  SELECT 'service_function_hardening',
    (SELECT count(*) = 2
      FROM pg_catalog.pg_proc AS p
      JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
      JOIN pg_catalog.pg_roles AS o ON o.oid = p.proowner
      WHERE n.nspname = 'bag_service'
        AND p.proname IN ('panden_in_viewport', 'zoek_panden')
        AND p.prosecdef AND p.provolatile = 's' AND o.rolname = 'postgres'
        AND 'jit=off' = ANY (p.proconfig)
        AND EXISTS (SELECT 1 FROM unnest(p.proconfig) AS cfg WHERE cfg LIKE 'search_path=%')),
    (SELECT count(*)::text
      FROM pg_catalog.pg_proc AS p
      JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
      JOIN pg_catalog.pg_roles AS o ON o.oid = p.proowner
      WHERE n.nspname = 'bag_service'
        AND p.proname IN ('panden_in_viewport', 'zoek_panden')
        AND p.prosecdef AND p.provolatile = 's' AND o.rolname = 'postgres'
        AND 'jit=off' = ANY (p.proconfig)
        AND EXISTS (SELECT 1 FROM unnest(p.proconfig) AS cfg WHERE cfg LIKE 'search_path=%')),
    '2 stable SECURITY DEFINER functions owned by postgres with fixed settings'
  UNION ALL
  SELECT 'application_isolation',
    (
      SELECT count(*) = 0
      FROM app_roles AS r
      CROSS JOIN bag_schemas AS s
      WHERE pg_catalog.has_schema_privilege(r.rolnaam, s.oid, 'USAGE')
    ) AND (
      SELECT count(*) = 0
      FROM app_roles AS r
      CROSS JOIN bag_tables AS t
      CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
        ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS privilege(privilege_name)
      WHERE pg_catalog.has_table_privilege(r.rolnaam, t.oid, privilege.privilege_name)
    ) AND (
      SELECT count(*) = 0
      FROM app_roles AS r
      CROSS JOIN required_functions AS f
      WHERE pg_catalog.has_function_privilege(r.rolnaam, f.signature, 'EXECUTE')
    ),
    '0 app-role schema/table/function privileges',
    '0 app-role schema/table/function privileges'
  UNION ALL
  SELECT 'intended_function_grants',
    pg_catalog.has_function_privilege('bag_publisher', 'bag_control.activeer_datasetversie(bigint)', 'EXECUTE')
      AND pg_catalog.has_function_privilege('bag_publisher', 'bag_control.rollback_datasetversie(bigint,bigint)', 'EXECUTE')
      AND pg_catalog.has_function_privilege('bag_reader', 'bag_service.panden_in_viewport(text,double precision,double precision,double precision,double precision,integer)', 'EXECUTE')
      AND pg_catalog.has_function_privilege('bag_reader', 'bag_service.zoek_panden(text,text,integer)', 'EXECUTE')
      AND NOT pg_catalog.has_function_privilege('bag_loader', 'bag_control.activeer_datasetversie(bigint)', 'EXECUTE')
      AND NOT pg_catalog.has_function_privilege('bag_reader', 'bag_control.activeer_datasetversie(bigint)', 'EXECUTE')
      AND NOT pg_catalog.has_function_privilege('bag_publisher', 'bag_service.zoek_panden(text,text,integer)', 'EXECUTE'),
    'publisher=2 version; reader=2 query; cross-role=0',
    'publisher=2 version; reader=2 query; cross-role=0'
  UNION ALL
  SELECT 'role_membership_contract',
    (SELECT count(*) = 4
      FROM pg_catalog.pg_auth_members AS m
      JOIN pg_catalog.pg_roles AS r ON r.oid = m.roleid
      WHERE r.rolname IN ('bag_loader', 'bag_publisher', 'bag_reader'))
    AND (SELECT count(*) = 3
      FROM pg_catalog.pg_auth_members AS m
      JOIN pg_catalog.pg_roles AS r ON r.oid = m.roleid
      JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = m.member
      JOIN pg_catalog.pg_roles AS grantor_role ON grantor_role.oid = m.grantor
      WHERE r.rolname IN ('bag_loader', 'bag_publisher', 'bag_reader')
        AND member_role.rolname = 'postgres'
        AND grantor_role.rolname = 'supabase_admin'
        AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option)
    AND (SELECT count(*) = 1
      FROM pg_catalog.pg_auth_members AS m
      JOIN pg_catalog.pg_roles AS r ON r.oid = m.roleid
      JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = m.member
      JOIN pg_catalog.pg_roles AS grantor_role ON grantor_role.oid = m.grantor
      WHERE r.rolname = 'bag_reader'
        AND member_role.rolname = 'bag_gateway'
        AND grantor_role.rolname = 'postgres'
        AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option),
    (SELECT count(*)::text || '/original=' || count(*) FILTER (
        WHERE member_role.rolname = 'postgres'
          AND grantor_role.rolname = 'supabase_admin'
          AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option
      )::text || '/gateway=' || count(*) FILTER (
        WHERE r.rolname = 'bag_reader'
          AND member_role.rolname = 'bag_gateway'
          AND grantor_role.rolname = 'postgres'
          AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option
      )::text
      FROM pg_catalog.pg_auth_members AS m
      JOIN pg_catalog.pg_roles AS r ON r.oid = m.roleid
      JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = m.member
      JOIN pg_catalog.pg_roles AS grantor_role ON grantor_role.oid = m.grantor
      WHERE r.rolname IN ('bag_loader', 'bag_publisher', 'bag_reader')),
    '4 total: 3 original Supabase grants plus 1 SET-only reader grant to gateway'
  UNION ALL
  SELECT 'dataset_state_invariant',
    NOT EXISTS (
      SELECT 1 FROM bag_control.datasetversies
      WHERE is_actief IS DISTINCT FROM (status = 'actief')
    ) AND NOT EXISTS (
      SELECT scope_code FROM bag_control.datasetversies
      WHERE is_actief GROUP BY scope_code HAVING count(*) > 1
    ),
    (SELECT count(*)::text FROM bag_control.datasetversies
      WHERE is_actief IS DISTINCT FROM (status = 'actief')),
    '0 status/active mismatches and max 1 active per scope'
  UNION ALL
  SELECT 'mode_dataset_gate',
    CASE :'expectation'
      WHEN 'clean-shadow' THEN
        (SELECT aantal = 0 FROM bag_rows)
        AND (SELECT count(*) = 0 FROM bag_control.datasetversies WHERE is_actief)
      WHEN 'active-dataset' THEN
        (SELECT count(*) = 1 FROM active_scope)
        AND (SELECT failures = 0 FROM active_parity)
      ELSE false
    END,
    'mode=' || :'expectation'
      || ',bag_rows=' || (SELECT aantal::text FROM bag_rows)
      || ',active_scope=' || (SELECT count(*)::text FROM active_scope)
      || ',parity_failures=' || (SELECT failures::text FROM active_parity),
    CASE :'expectation'
      WHEN 'clean-shadow' THEN '0 BAG rows and 0 active datasets'
      WHEN 'active-dataset' THEN '1 active dataset for scope with staging/published parity'
      ELSE 'known expectation'
    END
)
SELECT check_name, passed::integer, actual, expected
FROM checks
ORDER BY check_name;

COMMIT;
