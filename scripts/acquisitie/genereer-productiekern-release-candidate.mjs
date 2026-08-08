import fs from 'node:fs';
import path from 'node:path';

const bronnen = [
  'supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql',
  'supabase/migration-drafts/20260806_acquisitie_productiekern_dossier_briefkern.sql',
  'supabase/migration-drafts/20260808_acquisitie_productiekern_vroege_transactionele_functies.sql',
  'supabase/migration-drafts/20260806_acquisitie_productiekern_transactionele_functies.sql',
  'supabase/migration-drafts/20260808_acquisitie_productiekern_post_opvolging_atomiciteit.sql',
  'supabase/migration-drafts/20260808_acquisitie_productiekern_security_wrappers.sql',
];

const activatieBron = 'supabase/migration-drafts/20260808_acquisitie_productiekern_activatie_security.sql';
const uitvoer = process.argv[2]
  ?? 'dist/acquisitie-productiekern/20260808_acquisitie_productiekern_release_candidate.sql';

function normaliseerBron(bestand) {
  const origineel = fs.readFileSync(bestand, 'utf8').replace(/\r\n/g, '\n');
  if (!/^\s*--/m.test(origineel)) throw new Error(`SQL-bron zonder reviewheader: ${bestand}`);
  if (!/^\s*begin;\s*$/im.test(origineel)) throw new Error(`SQL-bron mist BEGIN: ${bestand}`);
  if (!/^\s*rollback;\s*$/im.test(origineel)) throw new Error(`SQL-bron mist ROLLBACK: ${bestand}`);

  const zonderBegin = origineel.replace(/^\s*begin;\s*$/im, '');
  const zonderTransactie = zonderBegin.replace(/^\s*rollback;\s*$/im, '');
  if (/^\s*(begin|commit|rollback);\s*$/im.test(zonderTransactie)) {
    throw new Error(`SQL-bron bevat onverwachte top-level transactiemarker: ${bestand}`);
  }
  return zonderTransactie.trim();
}

for (const bron of bronnen) {
  if (!fs.existsSync(bron)) throw new Error(`Ontbrekende releasebron: ${bron}`);
}
if (!fs.existsSync(activatieBron)) throw new Error(`Ontbrekende activatiebron: ${activatieBron}`);

const secties = bronnen.map((bron, index) => {
  const body = normaliseerBron(bron);
  return `\n-- ===========================================================================\n-- RELEASEDEEL ${index + 1}: ${bron}\n-- ===========================================================================\n${body}\n`;
});

const inhoud = `-- ACQUISITIEPRODUCTIEKERN — REVIEW-ONLY RELEASE CANDIDATE\n-- GEGENEREERD BESTAND; NIET HANDMATIG BEWERKEN.\n-- Bronnen staan in vaste volgorde in scripts/acquisitie/genereer-productiekern-release-candidate.mjs.\n-- Dit bestand bevat GEEN activatie-security, GEEN client-grants en GEEN backfill.\n-- Productietoepassing vereist afzonderlijk expliciet akkoord.\n-- Activatiebron (niet opgenomen): ${activatieBron}\n\nbegin;\n${secties.join('\n')}\ncommit;\n`;

fs.mkdirSync(path.dirname(uitvoer), { recursive: true });
fs.writeFileSync(uitvoer, inhoud, 'utf8');
console.log(uitvoer);
