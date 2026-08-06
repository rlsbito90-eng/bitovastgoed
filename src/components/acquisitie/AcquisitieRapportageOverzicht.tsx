import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, CalendarClock, Mail, Target, TrendingUp, Users } from 'lucide-react';
import { useAcquisitie } from '@/hooks/useAcquisitie';
import { useDataStore } from '@/hooks/useDataStore';
import { CAMPAGNE_KANAAL_LABEL, CAMPAGNE_STATUS_LABEL } from '@/lib/acquisitie';
import { formatCurrencyCompact } from '@/data/mock-data';

function pct(teller: number, noemer: number): string {
  return noemer > 0 ? `${Math.round((teller / noemer) * 100)}%` : '—';
}

export interface AcquisitieRapportage {
  targets: number;
  eigenaarGekoppeld: number;
  reacties: number;
  warm: number;
  objecten: number;
  openActies: number;
  verlopenActies: number;
  conversieReactie: string;
  conversieObject: string;
  verwachteFeePipeline: number;
}

export function berekenAcquisitieRapportage(
  targets: Array<{
    relatieId: string | null;
    objectId: string | null;
    status: string;
    volgendeActieDatum: string | null;
  }>,
  deals: Array<{
    objectId: string;
    fase: string;
    commissieBedrag?: number | null;
  }>,
  vandaag = new Date().toISOString().slice(0, 10),
): AcquisitieRapportage {
  const objectIds = new Set(targets.map((t) => t.objectId).filter((id): id is string => !!id));
  const reacties = targets.filter((t) => [
    'reactie_ontvangen',
    'verkoopbereidheid_peilen',
    'potentiele_verkooppositie',
    'object_aangemaakt',
  ].includes(t.status)).length;
  const warm = targets.filter((t) => [
    'verkoopbereidheid_peilen',
    'potentiele_verkooppositie',
  ].includes(t.status)).length;
  const objecten = targets.filter((t) => !!t.objectId || t.status === 'object_aangemaakt').length;
  const actief = targets.filter((t) => !['object_aangemaakt', 'niet_interessant'].includes(t.status));
  const verlopenActies = actief.filter((t) => !!t.volgendeActieDatum && t.volgendeActieDatum < vandaag).length;
  const verwachteFeePipeline = deals
    .filter((d) => objectIds.has(d.objectId) && !['afgerond', 'afgevallen'].includes(d.fase))
    .reduce((som, d) => som + (d.commissieBedrag ?? 0), 0);

  return {
    targets: targets.length,
    eigenaarGekoppeld: targets.filter((t) => !!t.relatieId).length,
    reacties,
    warm,
    objecten,
    openActies: actief.length,
    verlopenActies,
    conversieReactie: pct(reacties, targets.length),
    conversieObject: pct(objecten, targets.length),
    verwachteFeePipeline,
  };
}

export default function AcquisitieRapportageOverzicht() {
  const { targets, campagnes, laden } = useAcquisitie();
  const { deals } = useDataStore();

  const rapport = useMemo(
    () => berekenAcquisitieRapportage(targets, deals),
    [targets, deals],
  );

  const campagneRijen = useMemo(() => campagnes.map((campagne) => {
    const lijst = targets.filter((t) => t.campagneId === campagne.id);
    const reacties = lijst.filter((t) => [
      'reactie_ontvangen', 'verkoopbereidheid_peilen',
      'potentiele_verkooppositie', 'object_aangemaakt',
    ].includes(t.status)).length;
    const objecten = lijst.filter((t) => !!t.objectId || t.status === 'object_aangemaakt').length;
    return {
      campagne,
      targets: lijst.length,
      reacties,
      objecten,
      responsPct: pct(reacties, lijst.length),
    };
  }).sort((a, b) => b.targets - a.targets), [campagnes, targets]);

  if (laden) return <p className="px-5 py-10 text-sm text-muted-foreground">Rapportage laden…</p>;

  return (
    <div className="space-y-4" data-testid="acquisitie-rapportage">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi icon={Target} label="Targets" value={String(rapport.targets)} sub={`${rapport.eigenaarGekoppeld} eigenaar gekoppeld`} />
        <Kpi icon={Mail} label="Reacties" value={String(rapport.reacties)} sub={`${rapport.conversieReactie} respons`} />
        <Kpi icon={Building2} label="Objecten" value={String(rapport.objecten)} sub={`${rapport.conversieObject} target → object`} />
        <Kpi icon={TrendingUp} label="Fee-pipeline" value={formatCurrencyCompact(rapport.verwachteFeePipeline)} sub="gekoppelde actieve deals" />
        <Kpi icon={Users} label="Warme posities" value={String(rapport.warm)} sub="verkoopbereid of potentiële positie" />
        <Kpi icon={CalendarClock} label="Open acties" value={String(rapport.openActies)} sub={`${rapport.verlopenActies} verlopen`} danger={rapport.verlopenActies > 0} />
        <Kpi icon={Mail} label="Campagnes" value={String(campagnes.length)} sub={`${campagnes.filter((c) => c.status === 'actief').length} actief`} />
        <div className="section-card p-3 border-dashed">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-xs font-medium">Mailingkosten</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Nog geen betrouwbare kostenbron geregistreerd. Daarom wordt geen bedrag of kosten-per-reactie berekend.
          </p>
        </div>
      </div>

      <section className="section-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Conversie per campagne</h3>
          <p className="text-xs text-muted-foreground">Gebaseerd op bestaande targetstatussen en objectkoppelingen.</p>
        </div>
        {campagneRijen.length === 0 ? (
          <p className="px-5 py-10 text-sm text-muted-foreground">Nog geen campagnes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Campagne</th>
                  <th className="text-right px-4 py-2 font-medium">Targets</th>
                  <th className="text-right px-4 py-2 font-medium">Reacties</th>
                  <th className="text-right px-4 py-2 font-medium">Respons</th>
                  <th className="text-right px-4 py-2 font-medium">Objecten</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {campagneRijen.map((rij) => (
                  <tr key={rij.campagne.id}>
                    <td className="px-4 py-3">
                      <Link to={`/acquisitie/campagnes/${rij.campagne.id}`} className="font-medium hover:text-accent hover:underline">
                        {rij.campagne.naam}
                      </Link>
                      <p className="text-[11px] text-muted-foreground">
                        {CAMPAGNE_KANAAL_LABEL[rij.campagne.kanaal]} · {CAMPAGNE_STATUS_LABEL[rij.campagne.status]}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono-data">{rij.targets}</td>
                    <td className="px-4 py-3 text-right font-mono-data">{rij.reacties}</td>
                    <td className="px-4 py-3 text-right font-mono-data">{rij.responsPct}</td>
                    <td className="px-4 py-3 text-right font-mono-data">{rij.objecten}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, danger = false }: {
  icon: typeof Target;
  label: string;
  value: string;
  sub: string;
  danger?: boolean;
}) {
  return (
    <div className={`section-card p-3 ${danger ? 'border-destructive/40' : ''}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={`h-4 w-4 ${danger ? 'text-destructive' : ''}`} />
        <p className="text-[10px] uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-xl font-semibold font-mono-data mt-2 ${danger ? 'text-destructive' : ''}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
