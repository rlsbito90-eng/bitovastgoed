import { BarChart3, CheckCircle2, CircleDashed, FlaskConical, Info, ShieldCheck } from 'lucide-react';
import { useAcquisitieConversieDashboard } from '@/hooks/useAcquisitieConversieDashboard';
import type { ConversieRij } from '@/lib/acquisitie/conversieDashboard';
import { ACQUISITIE_EXPERIMENT_PLAYBOOK } from '@/lib/acquisitie/experimentPlaybook';

const pct = (value: number) => `${new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 }).format(value)}%`;

function ConversieTabel({ titel, toelichting, rijen }: { titel: string; toelichting: string; rijen: ConversieRij[] }) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{titel}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{toelichting}</p>
      </div>
      {rijen.length === 0 ? (
        <div className="px-4 py-5 text-sm text-muted-foreground">Nog onvoldoende verzenddata.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/20 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Groep</th>
                <th className="px-3 py-2 text-right font-medium">Verzonden</th>
                <th className="px-3 py-2 text-right font-medium">Reacties</th>
                <th className="px-3 py-2 text-right font-medium">Respons</th>
                <th className="px-3 py-2 text-right font-medium">Kwalitatief</th>
                <th className="px-4 py-2 text-right font-medium">Qualified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rijen.map(rij => (
                <tr key={rij.sleutel}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{rij.label}</td>
                  <td className="px-3 py-2.5 text-right font-mono-data">{rij.verzonden}</td>
                  <td className="px-3 py-2.5 text-right font-mono-data">{rij.reacties}</td>
                  <td className="px-3 py-2.5 text-right font-mono-data">{pct(rij.responspercentage)}</td>
                  <td className="px-3 py-2.5 text-right font-mono-data">
                    {rij.kwalitatieveReacties} <span className="text-muted-foreground">· {pct(rij.kwalitatieveResponspercentage)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-data">
                    {rij.gekwalificeerdeLeads} <span className="text-muted-foreground">· {pct(rij.gekwalificeerdeLeadPercentage)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AcquisitieConversieDashboard() {
  const jaar = new Date().getFullYear();
  const { model, richting, isLoading, error } = useAcquisitieConversieDashboard(jaar);

  if (isLoading) {
    return <section className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Conversiedashboard laden…</section>;
  }

  if (error) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Conversie & experimenten</h2>
        <p className="mt-1 text-sm text-muted-foreground">De conversiedata kon niet worden geladen. De bestaande acquisitiemeetlaag blijft beschikbaar.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4" data-testid="acquisitie-conversie-dashboard">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Conversie & experimenten</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Eén centraal overzicht. Reacties worden toegerekend aan de communicatie waarop is gereageerd, niet aan het inkomende antwoordkanaal.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" /> Cohortbasis · {jaar}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Metric label="Verzonden" value={String(model.totaal.verzonden)} detail="Unieke communicaties" />
        <Metric label="Reacties" value={String(model.totaal.reacties)} detail={`${pct(model.totaal.responspercentage)} respons`} />
        <Metric label="Kwalitatieve reacties" value={String(model.totaal.kwalitatieveReacties)} detail={`${pct(model.totaal.kwalitatieveResponspercentage)} van verzonden`} />
        <Metric label="Gekwalificeerde leads" value={String(model.totaal.gekwalificeerdeLeads)} detail={`${pct(model.totaal.gekwalificeerdeLeadPercentage)} van verzonden`} />
        <Metric
          label="Attributiecontrole"
          value={model.reactiesZonderVerzending === 0 ? '100%' : `${model.reactiesZonderVerzending} los`}
          detail={model.reactiesZonderVerzending === 0 ? 'Alle reacties koppelbaar' : 'Reacties zonder gevonden verzending'}
        />
      </div>

      <ResponsKwaliteit model={model.responsKwaliteit} />
      <ResponsRichting model={richting} />

      <ExperimentPlaybook experimenten={model.experimenten} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ConversieTabel
          titel="Per contactkanaal"
          toelichting="Respons is gekoppeld aan het kanaal van de oorspronkelijke verzending. Kwalitatief = interesse of gesprek gepland; qualified = gesprek gepland."
          rijen={model.perKanaal}
        />
        <ConversieTabel
          titel="Per touchpoint"
          toelichting="Brief 1, E-mail 1 en toekomstige opvolgstappen zijn vergelijkbaar op volume én leadkwaliteit."
          rijen={model.perTouchpoint}
        />
      </div>

      <ConversieTabel
        titel="Ontwikkeling per verzendcohort"
        toelichting="Reacties die later binnenkomen blijven bij de maand van de oorspronkelijke verzending staan."
        rijen={model.perMaand}
      />

      <ConversieTabel
        titel="Per tekstvariant"
        toelichting="Varianten worden nu ook vergeleken op kwalitatieve respons en gekwalificeerde leads. Historische verzendingen zonder variant blijven buiten deze vergelijking."
        rijen={model.perVariant}
      />

      <div className="rounded-md border border-dashed border-border bg-muted/10 p-4 flex gap-3">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium text-foreground">Experimentdekking · {model.variantGelabeld}/{model.totaal.verzonden}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Vanaf deze release wordt de toegewezen variant per communicatie vastgelegd. {model.variantOngelabeld > 0 ? `${model.variantOngelabeld} historische verzending(en) hebben bewust geen variantlabel.` : 'Alle gemeten verzendingen hebben een variantlabel.'} Varianten worden automatisch verdeeld, maar nooit automatisch gepromoveerd tot winnaar.
          </p>
        </div>
      </div>
    </section>
  );
}

function ResponsKwaliteit({ model }: { model: ReturnType<typeof useAcquisitieConversieDashboard>['model']['responsKwaliteit'] }) {
  const totaal = model.ongeclassificeerd + model.negatief + model.neutraalInfo + model.positiefGesprek + model.gekwalificeerdeLead;
  return (
    <div className="rounded-md border border-border overflow-hidden" data-testid="acquisitie-responskwaliteit">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Responskwaliteit</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Afgeleid van de canonieke responsstatus. Geen extra administratie: bestaande registratie wordt automatisch vertaald naar een kwaliteitsniveau.
        </p>
      </div>
      {totaal === 0 ? (
        <div className="px-4 py-5 text-sm text-muted-foreground">Nog geen inhoudelijke reacties in dit verzendcohort.</div>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
          <QualityCell label="Ongeclassificeerd" value={model.ongeclassificeerd} detail="Nog beoordelen" />
          <QualityCell label="Negatief" value={model.negatief} detail="Geen vervolg" />
          <QualityCell label="Neutraal / info" value={model.neutraalInfo} detail="Later of meer info" />
          <QualityCell label="Positief gesprek" value={model.positiefGesprek} detail="Concrete interesse" />
          <QualityCell label="Qualified lead" value={model.gekwalificeerdeLead} detail="Gesprek gepland" />
        </div>
      )}
    </div>
  );
}

function ResponsRichting({ model }: { model: ReturnType<typeof useAcquisitieConversieDashboard>['richting'] }) {
  const bekend = model.verkoperReacties + model.koperReacties + model.beideReacties;
  const totaal = bekend + model.onbekendReacties;
  return (
    <div className="rounded-md border border-border overflow-hidden" data-testid="acquisitie-responsrichting">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Commerciële richting</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Scheidt verkoopaanbod van nieuwe koopvraag. Een reactie kan dus commercieel waardevol zijn zonder dat de eigenaar wil verkopen.
        </p>
      </div>
      {totaal === 0 ? (
        <div className="px-4 py-5 text-sm text-muted-foreground">Nog geen reacties met commerciële richting vastgelegd.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            <QualityCell label="Verkoper / aanbod" value={model.verkoperReacties} detail={`Qualified: ${model.gekwalificeerdeVerkoperLeads}`} />
            <QualityCell label="Koper / zoekvraag" value={model.koperReacties} detail={`Qualified: ${model.gekwalificeerdeKoperLeads}`} />
            <QualityCell label="Beide" value={model.beideReacties} detail="Aanbod én zoekvraag" />
            <QualityCell label="Overig / onbekend" value={model.onbekendReacties} detail="Nog classificeren" />
          </div>
          {model.perVariant.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <div className="text-xs font-medium text-foreground">Richting per tekstvariant</div>
              <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                {model.perVariant.map(row => (
                  <div key={row.sleutel} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{row.label}</span>
                    <span className="font-mono-data">verkoper {row.verkoperReacties} · koper {row.koperReacties} · Q-seller {row.gekwalificeerdeVerkoperLeads} · Q-buyer {row.gekwalificeerdeKoperLeads}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExperimentPlaybook({ experimenten }: { experimenten: ReturnType<typeof useAcquisitieConversieDashboard>['model']['experimenten'] }) {
  const regels = ACQUISITIE_EXPERIMENT_PLAYBOOK;
  const actief = experimenten.filter(e => e.varianten.some(v => v.verzonden > 0));

  return (
    <div className="rounded-md border border-border overflow-hidden" data-testid="acquisitie-experiment-playbook">
      <div className="border-b border-border px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Experiment playbook</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Automatische verdeling, vaste spelregels en een handmatig beslismoment. Kandidaat-winnaars worden primair beoordeeld op kwalitatieve verkopersrespons; koperreacties blijven waardevolle secundaire opbrengst.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full border border-border px-2 py-1">≥ {regels.minimumLooptijdDagen} dagen</span>
          <span className="rounded-full border border-border px-2 py-1">≥ {regels.minimumPerVariant} per variant</span>
          <span className="rounded-full border border-border px-2 py-1">streef ≥ {regels.streefPerVariant}</span>
          <span className="rounded-full border border-border px-2 py-1">1 hypothese per test</span>
        </div>
      </div>

      {actief.length === 0 ? (
        <div className="px-4 py-5 text-sm text-muted-foreground">Nog geen nieuwe gelabelde verzendingen om als experiment te bewaken.</div>
      ) : (
        <div className="divide-y divide-border">
          {actief.map(experiment => (
            <div key={experiment.sleutel} className="px-4 py-4 space-y-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{experiment.label}</span>
                    <span className="rounded-full border border-border bg-muted/20 px-2 py-0.5 text-[11px] text-muted-foreground">{experiment.statusLabel}</span>
                    {experiment.kandidaatVariantCode && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-foreground">Kandidaat {experiment.kandidaatVariantCode}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{experiment.advies}</p>
                </div>
                <div className="text-xs text-muted-foreground lg:text-right">
                  <div>{experiment.looptijdDagen} dagen actief</div>
                  <div>{experiment.kanaal === 'email' ? 'E-mail' : 'Post'}</div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {experiment.varianten.map(variant => (
                  <div key={variant.sleutel} className="rounded-md border border-border bg-muted/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground">Variant {variant.variantCode}{variant.isControl ? ' · controle' : ''}</span>
                      <span className="text-[11px] text-muted-foreground">n={variant.verzonden}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <span>Seller kwal. <strong className="font-mono-data text-foreground">{pct(variant.kwalitatieveVerkoperResponspercentage)}</strong></span>
                      <span>Q-seller <strong className="font-mono-data text-foreground">{pct(variant.gekwalificeerdeVerkoperLeadPercentage)}</strong></span>
                      <span>Seller reacties <strong className="font-mono-data text-foreground">{variant.verkoperReacties}</strong></span>
                      <span>Koperreacties <strong className="font-mono-data text-foreground">{variant.koperReacties}</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <PlaybookCheck ok={experiment.checks.meerdereVarianten} label="challenger actief" />
                <PlaybookCheck ok={experiment.checks.minimumLooptijd} label={`${regels.minimumLooptijdDagen} dagen`} />
                <PlaybookCheck ok={experiment.checks.minimumVolume} label={`${regels.minimumPerVariant} per variant`} />
                <PlaybookCheck ok={experiment.checks.streefvolume} label={`streefvolume ${regels.streefPerVariant}`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaybookCheck({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CheckCircle2 : CircleDashed;
  return <span className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5" />{label}</span>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold font-mono-data text-foreground">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function QualityCell({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="bg-card px-3 py-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold font-mono-data text-foreground">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{detail}</div>
    </div>
  );
}
