export interface BagValidatieSqlBundel {
  preflight: string;
  integriteit: string;
  publicatiepoort: string;
  rollbackControle: string;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function bouwAmsterdamShadowValidatieSql(input: {
  scopeCode: '0363';
  datasetVersie: string;
}): BagValidatieSqlBundel {
  const scope = quoteLiteral(input.scopeCode);
  const dataset = quoteLiteral(input.datasetVersie);

  return {
    preflight: `select ${scope} as scope_code, ${dataset} as dataset_versie,\n  count(*) filter (where schemaname = 'bag_staging') as staging_tabellen\nfrom pg_tables\nwhere schemaname in ('bag_staging', 'bag_core', 'bag_audit');`,
    integriteit: `with tellingen as (\n  select\n    (select count(*) from bag_staging.objecten where scope_code = ${scope}) as objecten,\n    (select count(*) from bag_staging.voorkomens where scope_code = ${scope}) as voorkomens,\n    (select count(*) from bag_staging.relaties where scope_code = ${scope}) as relaties,\n    (select count(*) from bag_staging.geometrieen where scope_code = ${scope}) as geometrieen\n)\nselect *, (objecten > 0 and voorkomens > 0 and relaties > 0 and geometrieen > 0) as basis_geldig\nfrom tellingen;`,
    publicatiepoort: `select\n  ${scope} as scope_code,\n  ${dataset} as dataset_versie,\n  not exists (select 1 from bag_staging.quarantaine where scope_code = ${scope} and afgehandeld_op is null) as quarantaine_afgehandeld,\n  exists (select 1 from bag_audit.import_runs where scope_code = ${scope} and dataset_versie = ${dataset} and status = 'validated') as run_gevalideerd;`,
    rollbackControle: `select\n  ${scope} as scope_code,\n  ${dataset} as dataset_versie,\n  exists (select 1 from bag_audit.rollback_markers where scope_code = ${scope} and dataset_versie = ${dataset}) as rollbackmarker_aanwezig;`,
  };
}
