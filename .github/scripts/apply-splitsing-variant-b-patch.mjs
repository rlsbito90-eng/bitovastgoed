import fs from 'node:fs';

const path = 'src/components/offmarket/BriefVoorbereidenDialog.tsx';
let src = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  if (!src.includes(from)) throw new Error(`Patchanker ontbreekt: ${label}`);
  src = src.replace(from, to);
}

replaceOnce(
  "import { bepaalCopyProfiel, kiesCopyVariant, copyProfielLabel } from '@/lib/acquisitie/copyExperimenten';\n",
  "import { bepaalCopyProfiel, kiesCopyVariant, copyProfielLabel } from '@/lib/acquisitie/copyExperimenten';\nimport { bouwPostVariantTemplate } from '@/lib/acquisitie/postCopyVarianten';\n",
  'import postCopyVarianten',
);

replaceOnce(
`  const herstelStandaard = () => {\n    setBrieftekst(bouwBriefTekst({ aanhef, objectadres: objectomschrijving }));\n    toast.success('Standaardtekst hersteld');\n  };\n`,
`  const herstelStandaard = () => {\n    if (kanaal === 'post') {\n      const template = bouwPostVariantTemplate({ toewijzing: copyToewijzing, aanhef, objectomschrijving });\n      setBrieftekst(template.brieftekst);\n    } else {\n      setBrieftekst(bouwBriefTekst({ aanhef, objectadres: objectomschrijving }));\n    }\n    toast.success('Standaardtekst hersteld');\n  };\n`,
  'herstelStandaard',
);

const copyBlock = `  const copyToewijzing = useMemo(() => {\n    const profiel = bepaalCopyProfiel({ signaal, kanaal, emailProfiel });\n    return kiesCopyVariant({\n      profiel, kanaal, campagneStap: huidigeCampagneStap, signaalId: signaal.id,\n      geadresseerdeKey: initialBrief?.geadresseerde_key ?? kandidaatLabel ?? null,\n    });\n  }, [signaal, kanaal, emailProfiel, huidigeCampagneStap, initialBrief?.geadresseerde_key, kandidaatLabel]);\n`;

const copyBlockMetEffect = `${copyBlock}\n  // Eerste echte post-copytest. Alleen een nieuw, nog niet opgeslagen concept\n  // met toegewezen challenger B krijgt automatisch de varianttekst.\n  // Controle A en bestaande/historische brieven behouden exact hun bestaande flow.\n  useEffect(() => {\n    if (!open || initialBrief || kanaal !== 'post' || copyToewijzing.variantCode !== 'B') return;\n    const template = bouwPostVariantTemplate({ toewijzing: copyToewijzing, aanhef, objectomschrijving });\n    if (!onderwerpHandmatig) setOnderwerp(template.onderwerp);\n    setBrieftekst(template.brieftekst);\n  }, [\n    open, initialBrief, kanaal, copyToewijzing.variantKey, copyToewijzing.variantCode,\n    aanhef, objectomschrijving, onderwerpHandmatig,\n  ]);\n`;

replaceOnce(copyBlock, copyBlockMetEffect, 'copyToewijzing effect');

fs.writeFileSync(path, src);
