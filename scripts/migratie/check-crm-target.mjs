#!/usr/bin/env node

export const CRM_DOELPROJECT = 'vyjocdlwfxrblusfngfq';

export const VERBODEN_PROJECTEN = Object.freeze({
  'ljudxyrqoifhfikueric': 'Lovable CRM-productie is uitsluitend migratiebron en mag nooit CRM-migratiedoel zijn.',
  'wzkhmjuasyuvzhhycnym': 'Lovable CRM-shadow wordt niet gebruikt voor de nieuwe zelfstandige CRM-architectuur.',
  'xfygspvpeugxowxbcvnm': 'Dit project is uitsluitend voor BAG en mag nooit CRM-doel worden.',
});

export function valideerCrmDoel(projectId) {
  const waarde = String(projectId ?? '').trim();

  if (!waarde) {
    return {
      ok: false,
      code: 'doel_ontbreekt',
      reden: 'CRM_TARGET_PROJECT_ID ontbreekt. Zonder expliciet doel wordt niets uitgevoerd.',
    };
  }

  if (Object.prototype.hasOwnProperty.call(VERBODEN_PROJECTEN, waarde)) {
    return {
      ok: false,
      code: 'doel_verboden',
      reden: VERBODEN_PROJECTEN[waarde],
    };
  }

  if (waarde !== CRM_DOELPROJECT) {
    return {
      ok: false,
      code: 'doel_onbekend',
      reden: `Onbekend CRM-doelproject ${waarde}. Alleen ${CRM_DOELPROJECT} is toegestaan.`,
    };
  }

  return {
    ok: true,
    code: 'doel_bevestigd',
    reden: `CRM-doelproject bevestigd: ${CRM_DOELPROJECT}.`,
  };
}

function runCli() {
  const resultaat = valideerCrmDoel(process.env.CRM_TARGET_PROJECT_ID);
  const prefix = resultaat.ok ? '[CRM target guard OK]' : '[CRM target guard BLOCKED]';
  console.log(`${prefix} ${resultaat.reden}`);
  if (!resultaat.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
