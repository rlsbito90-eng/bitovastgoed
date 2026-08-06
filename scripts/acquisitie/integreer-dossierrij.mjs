import { readFile } from 'node:fs/promises';

const pad = 'src/components/offmarket/acquisitie/AcquisitieSelectieTab.tsx';
const bron = await readFile(pad, 'utf8');

const controles = [
  {
    naam: 'samengestelde dossiercomponent geïmporteerd',
    voldaan: bron.includes("import AcquisitieDossierRij from './AcquisitieDossierRij';"),
  },
  {
    naam: 'samengestelde dossiercomponent gebruikt',
    voldaan: bron.includes('<AcquisitieDossierRij'),
  },
  {
    naam: 'in-klapbare geadresseerden verwijderd',
    voldaan: !bron.includes('<details className="mt-1.5" data-testid="acquisitie-rij-geadresseerden">'),
  },
  {
    naam: 'oude ruwe lijstitemcontainer verwijderd',
    voldaan: !bron.includes('data-testid="acquisitie-selectie-rij"\n                data-signaal-id'),
  },
];

const ontbrekend = controles.filter((controle) => !controle.voldaan);
for (const controle of controles) {
  console.log(`${controle.voldaan ? '✓' : '✗'} ${controle.naam}`);
}

if (ontbrekend.length > 0) {
  console.error('\nDe dossier-rijintegratie is nog niet volledig toegepast.');
  process.exitCode = 1;
} else {
  console.log('\nDe dossier-rijintegratie is volledig aantoonbaar aanwezig.');
}
