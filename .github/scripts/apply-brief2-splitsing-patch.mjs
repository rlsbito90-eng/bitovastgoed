import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected 1 match, got ${count}`);
  fs.writeFileSync(path, source.replace(before, after));
}

replaceOnce(
  'src/lib/acquisitie/postCopyVarianten.ts',
  "const SPLITSING_BRIEF_1_B_KEY = 'splitsingspotentie:post:brief_1:B';\n",
  "const SPLITSING_BRIEF_1_B_KEY = 'splitsingspotentie:post:brief_1:B';\nconst SPLITSING_BRIEF_2_A_KEY = 'splitsingspotentie:post:brief_2:A';\n",
);

replaceOnce(
  'src/lib/acquisitie/postCopyVarianten.ts',
  "}: PostVariantTemplateInput): PostVariantTemplate {\n  if (toewijzing.variantKey !== SPLITSING_BRIEF_1_B_KEY || toewijzing.variantCode !== 'B') {\n    return {\n      onderwerp: bepaalOnderwerp(objectomschrijving),\n      brieftekst: bouwBriefTekst({ aanhef, objectadres: objectomschrijving }),\n    };\n  }\n\n  const object = objectomschrijving.trim();\n",
  "}: PostVariantTemplateInput): PostVariantTemplate {\n  const object = objectomschrijving.trim();\n\n  if (toewijzing.variantKey === SPLITSING_BRIEF_2_A_KEY && toewijzing.variantCode === 'A') {\n    const objectRef = object ? `het vastgoed aan ${object}` : 'uw vastgoed';\n    const onderwerp = object\n      ? `Nogmaals over het vastgoed aan ${object}`\n      : 'Nogmaals over uw vastgoed';\n\n    return {\n      onderwerp,\n      brieftekst: [\n        aanhef,\n        '',\n        `Enige tijd geleden stuurde ik u een brief naar aanleiding van ${objectRef}. Mogelijk kwam mijn eerdere bericht op een minder geschikt moment, daarom neem ik kort opnieuw contact met u op.`,\n        '',\n        'Het object sluit vanwege de mogelijke splitsings- of uitpondingspotentie aan bij vastgoed waar professionele beleggers en ontwikkelaars regelmatig naar zoeken.',\n        '',\n        'Mocht verkoop van dit pand nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact. Ook wanneer dit specifieke object niet speelt, maar u ander vastgoed of een bredere portefeuille heeft waarvoor verkoop of een marktverkenning relevant kan zijn, hoor ik dat graag.',\n        '',\n        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',\n        '',\n        'Met vriendelijke groet,',\n        '',\n        BITO_CONTACT.naam,\n        BITO_CONTACT.functie,\n        BITO_CONTACT.bedrijf,\n        '',\n        `T: ${BITO_CONTACT.telefoon}`,\n        `E: ${BITO_CONTACT.email}`,\n        `W: ${BITO_CONTACT.website}`,\n      ].join('\\n'),\n    };\n  }\n\n  if (toewijzing.variantKey !== SPLITSING_BRIEF_1_B_KEY || toewijzing.variantCode !== 'B') {\n    return {\n      onderwerp: bepaalOnderwerp(objectomschrijving),\n      brieftekst: bouwBriefTekst({ aanhef, objectadres: objectomschrijving }),\n    };\n  }\n\n",
);

replaceOnce(
  'src/components/offmarket/BriefVoorbereidenDialog.tsx',
  "import { bouwPostVariantTemplate } from '@/lib/acquisitie/postCopyVarianten';\n",
  "import { bouwPostVariantTemplate } from '@/lib/acquisitie/postCopyVarianten';\nimport { bepaalVolgendePostCampagneStap } from '@/lib/acquisitie/postCampagneStap';\nimport { geadresseerdeKey } from '@/lib/offMarket/brieven/geadresseerdeKey';\n",
);

replaceOnce(
  'src/components/offmarket/BriefVoorbereidenDialog.tsx',
  "    if (initialBrief?.campagne_stap) return initialBrief.campagne_stap as string;\n    if (kanaal === 'email') return volgendeEmailStap(signaalBrieven);\n    return 'brief_1';\n  }, [initialBrief, kanaal, signaalBrieven]);\n",
  "    if (initialBrief?.campagne_stap) return initialBrief.campagne_stap as string;\n    if (kanaal === 'email') return volgendeEmailStap(signaalBrieven);\n    const kandidaatKey = geadresseerdeKey({\n      id: briefId ?? 'nieuw',\n      eigenaar_naam: eigenaarNaam || null,\n      eigenaar_bedrijfsnaam: eigenaarBedrijfsnaam || null,\n      verzendadres: verzendadresVoorOpslag(),\n    });\n    return bepaalVolgendePostCampagneStap({\n      brieven: signaalBrieven,\n      geadresseerdeKey: kandidaatKey,\n      eigenaarNaam,\n      eigenaarBedrijfsnaam,\n      verzendadres: verzendadresVoorOpslag(),\n    });\n  }, [\n    initialBrief, kanaal, signaalBrieven, briefId,\n    eigenaarNaam, eigenaarBedrijfsnaam, verzendadres,\n  ]);\n",
);

replaceOnce(
  'src/components/offmarket/BriefVoorbereidenDialog.tsx',
  "  // Eerste echte post-copytest. Alleen een nieuw, nog niet opgeslagen concept\n  // met toegewezen challenger B krijgt automatisch de varianttekst.\n  // Controle A en bestaande/historische brieven behouden exact hun bestaande flow.\n  useEffect(() => {\n    if (!open || initialBrief || kanaal !== 'post' || copyToewijzing.variantCode !== 'B') return;\n",
  "  // Nieuwe postconcepten krijgen de template van hun vastgestelde campagne-stap\n  // en variant. Bestaande/historische brieven worden nooit stilzwijgend herschreven.\n  useEffect(() => {\n    if (!open || initialBrief || kanaal !== 'post') return;\n",
);

replaceOnce(
  'docs/acquisitie/CLAUDE_BRIEF_2_SPLITSING_BRIEFING.md',
  'Mogelijk kwam mijn eerdere bericht op een minder geschikt moment, daarom neem ik nog eenmaal kort contact met u op.',
  'Mogelijk kwam mijn eerdere bericht op een minder geschikt moment, daarom neem ik kort opnieuw contact met u op.',
);

console.log('brief2-splitsing patch applied');
