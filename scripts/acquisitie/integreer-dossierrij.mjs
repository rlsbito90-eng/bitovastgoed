import { readFile, writeFile } from 'node:fs/promises';

const pad = 'src/components/offmarket/acquisitie/AcquisitieSelectieTab.tsx';
let bron = await readFile(pad, 'utf8');

function vervangEenmaal(zoek, vervanging, omschrijving) {
  const eerste = bron.indexOf(zoek);
  const laatste = bron.lastIndexOf(zoek);
  if (eerste < 0) throw new Error(`Integratieanker ontbreekt: ${omschrijving}`);
  if (eerste !== laatste) throw new Error(`Integratieanker is niet uniek: ${omschrijving}`);
  bron = bron.replace(zoek, vervanging);
}

if (!bron.includes("import AcquisitieDossierRij from './AcquisitieDossierRij';")) {
  vervangEenmaal(
    "import MarkeerBulkDialog, { type MarkeerModus } from './MarkeerBulkDialog';",
    "import MarkeerBulkDialog, { type MarkeerModus } from './MarkeerBulkDialog';\nimport AcquisitieDossierRij from './AcquisitieDossierRij';",
    'importpositie dossiercomponent',
  );
}

vervangEenmaal(
  `              <li
                key={signaal.id}
                data-testid="acquisitie-selectie-rij"
                data-signaal-id={signaal.id}
                data-fase={r.fase}
                data-werkbak={ctx.werkbak}
                data-actie-categorie={ctx.actieCategorie ?? ''}
                className="p-3 sm:p-4"
              >`,
  `              <AcquisitieDossierRij
                key={signaal.id}
                geselecteerd={bulkChecked}
                onToggle={() => toggleBulk(signaal.id)}
                signaalId={signaal.id}
                fase={r.fase}
                werkbak={ctx.werkbak}
                actieCategorie={ctx.actieCategorie}
                geadresseerden={r.geadresseerden}
                acties={`,
  'openende dossier-rij',
);

vervangEenmaal(
  `                  <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:shrink-0">
                    <Button`,
  `                  <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:shrink-0">
                    <Button`,
  'actieblok begin',
);

vervangEenmaal(
  `                    <ToevoegenAanAcquisitieSelectieKnop
                      signaalId={signaal.id}
                      variant="compact"
                      labelMode="remove"
                      isInSelectie
                    />
                  </div>
                </div>
              </li>`,
  `                    <ToevoegenAanAcquisitieSelectieKnop
                      signaalId={signaal.id}
                      variant="compact"
                      labelMode="remove"
                      isInSelectie
                    />
                  </div>
                }
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <Checkbox
                      checked={bulkChecked}
                      onCheckedChange={() => toggleBulk(signaal.id)}
                      aria-label="Selecteer signaal voor bulkacties"
                      data-testid="acquisitie-rij-bulkcheck"
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Bestaande dossierinhoud blijft hier staan; de geadresseerden
                          worden door AcquisitieDossierRij altijd zichtbaar gerenderd. */}
                    </div>
                  </div>
                </div>
              </AcquisitieDossierRij>`,
  'sluitende dossier-rij',
);

if (bron.includes('<details className="mt-1.5" data-testid="acquisitie-rij-geadresseerden">')) {
  throw new Error('De inklapbare geadresseerdenmarkup is nog aanwezig; pas de integratie handmatig af.');
}

await writeFile(pad, bron, 'utf8');
console.log(`Dossier-rijintegratie toegepast op ${pad}`);
