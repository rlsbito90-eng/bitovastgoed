import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { parseOfficieelBagRecord, type BagOfficieelAdapterRecord } from '../../src/lib/bag/officieleXmlRecordAdapter';
import { voerIntegraleBagDryRunUit } from '../../src/lib/bag/integraleDryRun';
import { beoordeelBagDryRun } from '../../src/lib/bag/releaseGates';
import { dryRunFingerprint } from '../../src/lib/bag/importBatch';

interface NdjsonRecord {
  bronpad: string;
  xml: string;
}

async function main(): Promise<void> {
  const input = resolve(process.argv[2] ?? 'bag-broninspectie/records.ndjson');
  const outputDir = resolve(process.argv[3] ?? 'bag-broninspectie/dry-run');
  mkdirSync(outputDir, { recursive: true });

  const records: BagOfficieelAdapterRecord[] = [];
  const adapterFouten: string[] = [];
  let ontvangen = 0;

  const lines = createInterface({ input: createReadStream(input, { encoding: 'utf-8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    ontvangen += 1;
    let item: NdjsonRecord;
    try {
      item = JSON.parse(line) as NdjsonRecord;
    } catch (error) {
      adapterFouten.push(`ongeldige_ndjson:regel_${ontvangen}:${String(error)}`);
      continue;
    }
    const parsed = parseOfficieelBagRecord(item.xml);
    for (const fout of parsed.fouten) {
      adapterFouten.push(`${fout.code}:${item.bronpad}:${fout.reden}`);
    }
    if (parsed.record) records.push(parsed.record);
  }

  const dryRun = voerIntegraleBagDryRunUit({
    datasetVersie: 'v20200601',
    scopeCode: '0106',
    records,
    batchGrootte: 5_000,
  });

  const rapport = {
    ...dryRun.rapport,
    tellingen: {
      ...dryRun.rapport.tellingen,
      ontvangen,
      verwerkt: records.length,
      geweigerd: adapterFouten.length + dryRun.staging.fouten.length,
    },
    fouten: [...adapterFouten, ...dryRun.rapport.fouten].sort(),
  };

  const gate = beoordeelBagDryRun(rapport, {
    verplichteObjecttypen: [
      'Pand',
      'Verblijfsobject',
      'Nummeraanduiding',
      'OpenbareRuimte',
      'Woonplaats',
      'Standplaats',
      'Ligplaats',
    ],
    maximaalFoutpercentage: 0.01,
    minimaleRelatiedekking: 0.1,
    vereisGeometrieen: true,
    verwachteDatasetVersie: 'v20200601',
  });

  const resultaat = {
    gegenereerdOp: new Date().toISOString(),
    bron: { gemeenteCode: '0106', datasetVersie: 'v20200601' },
    batches: dryRun.batches,
    rapport,
    gate,
    fingerprint: dryRunFingerprint(rapport),
    stagingFouten: dryRun.staging.fouten,
  };

  writeFileSync(resolve(outputDir, 'resultaat.json'), `${JSON.stringify(resultaat, null, 2)}\n`, 'utf-8');

  const markdown = [
    '# BAG integrale Assen-dry-run',
    '',
    `- Gegenereerd: ${resultaat.gegenereerdOp}`,
    `- Datasetversie: ${resultaat.bron.datasetVersie}`,
    `- Gemeentecode: ${resultaat.bron.gemeenteCode}`,
    `- Batches: ${resultaat.batches}`,
    `- Ontvangen records: ${rapport.tellingen.ontvangen}`,
    `- Verwerkte records: ${rapport.tellingen.verwerkt}`,
    `- Geweigerde records/fouten: ${rapport.tellingen.geweigerd}`,
    `- Objecten: ${rapport.tellingen.objecten}`,
    `- Voorkomens: ${rapport.tellingen.voorkomens}`,
    `- Relaties: ${rapport.tellingen.relaties}`,
    `- Geometrieën: ${rapport.tellingen.geometrieen}`,
    `- Release-gates toegestaan: ${gate.toegestaan ? 'ja' : 'nee'}`,
    `- Fingerprint: \`${resultaat.fingerprint}\``,
    '',
    '## Objecttypen',
    ...Object.entries(rapport.tellingen.perObjecttype)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, aantal]) => `- ${type}: ${aantal}`),
    '',
    '## Blokkades',
    ...(gate.blokkades.length ? gate.blokkades.map(item => `- ${item}`) : ['- Geen']),
    '',
    '## Waarschuwingen',
    ...(gate.waarschuwingen.length ? gate.waarschuwingen.map(item => `- ${item}`) : ['- Geen']),
  ].join('\n');
  writeFileSync(resolve(outputDir, 'rapport.md'), `${markdown}\n`, 'utf-8');

  console.log(`Integrale dry-run afgerond: ${records.length}/${ontvangen} records verwerkt.`);
  console.log(`Release-gates toegestaan: ${gate.toegestaan ? 'ja' : 'nee'}.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
