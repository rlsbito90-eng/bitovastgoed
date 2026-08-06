import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CalendarClock, Search, UserRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAcquisitie } from '@/hooks/useAcquisitie';
import { useDataStore } from '@/hooks/useDataStore';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';
import { targetIsActief, targetTitel, type AcquisitieTarget } from '@/lib/acquisitie';

interface EigenaarGroep {
  key: string;
  relatieId: string | null;
  naam: string;
  targets: AcquisitieTarget[];
  objectIds: string[];
  openActies: number;
  verlopenActies: number;
  warmePosities: number;
  eerstvolgendeActie: string | null;
}

function isVerlopen(datum: string | null): boolean {
  if (!datum) return false;
  return datum < new Date().toISOString().slice(0, 10);
}

function isWarm(target: AcquisitieTarget): boolean {
  return target.status === 'reactie_ontvangen'
    || target.status === 'verkoopbereidheid_peilen'
    || target.status === 'potentiele_verkooppositie';
}

export function groepeerTargetsPerEigenaar(
  targets: AcquisitieTarget[],
  relatieNaam: (relatieId: string) => string | null,
): EigenaarGroep[] {
  const groepen = new Map<string, EigenaarGroep>();
  for (const target of targets) {
    const key = target.relatieId ?? `onbekend:${target.id}`;
    const naam = target.relatieId
      ? relatieNaam(target.relatieId) ?? 'Onbekende CRM-relatie'
      : 'Eigenaar nog niet gekoppeld';
    const groep = groepen.get(key) ?? {
      key,
      relatieId: target.relatieId,
      naam,
      targets: [],
      objectIds: [],
      openActies: 0,
      verlopenActies: 0,
      warmePosities: 0,
      eerstvolgendeActie: null,
    };
    groep.targets.push(target);
    if (target.objectId && !groep.objectIds.includes(target.objectId)) groep.objectIds.push(target.objectId);
    if (targetIsActief(target)) {
      groep.openActies += 1;
      if (isVerlopen(target.volgendeActieDatum)) groep.verlopenActies += 1;
      if (
        target.volgendeActieDatum
        && (!groep.eerstvolgendeActie || target.volgendeActieDatum < groep.eerstvolgendeActie)
      ) {
        groep.eerstvolgendeActie = target.volgendeActieDatum;
      }
    }
    if (isWarm(target)) groep.warmePosities += 1;
    groepen.set(key, groep);
  }

  return [...groepen.values()].sort((a, b) => {
    if (a.verlopenActies !== b.verlopenActies) return b.verlopenActies - a.verlopenActies;
    if (a.warmePosities !== b.warmePosities) return b.warmePosities - a.warmePosities;
    if (a.openActies !== b.openActies) return b.openActies - a.openActies;
    return a.naam.localeCompare(b.naam, 'nl-NL');
  });
}

export default function AcquisitieEigenarenOverzicht() {
  const { targets, laden } = useAcquisitie();
  const { relaties, contactpersonen, objecten } = useDataStore();
  const [zoek, setZoek] = useState('');

  const relatieMap = useMemo(() => new Map(relaties.map((r) => [r.id, r])), [relaties]);
  const objectMap = useMemo(() => new Map(objecten.map((o) => [o.id, o])), [objecten]);

  const groepen = useMemo(() => groepeerTargetsPerEigenaar(targets, (id) => {
    const relatie = relatieMap.get(id);
    return relatie ? getRelatieNaamCompact(relatie, contactpersonen) : null;
  }), [targets, relatieMap, contactpersonen]);

  const gefilterd = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    if (!q) return groepen;
    return groepen.filter((groep) => {
      const objectTekst = groep.objectIds
        .map((id) => objectMap.get(id))
        .map((o) => [o?.titel, o?.adres, o?.plaats].filter(Boolean).join(' '))
        .join(' ');
      const targetTekst = groep.targets.map(targetTitel).join(' ');
      return `${groep.naam} ${objectTekst} ${targetTekst}`.toLowerCase().includes(q);
    });
  }, [groepen, objectMap, zoek]);

  const totalen = useMemo(() => ({
    eigenaren: groepen.filter((g) => g.relatieId).length,
    onbekend: groepen.filter((g) => !g.relatieId).length,
    openActies: groepen.reduce((n, g) => n + g.openActies, 0),
    warm: groepen.reduce((n, g) => n + g.warmePosities, 0),
  }), [groepen]);

  if (laden) return <p className="px-5 py-10 text-sm text-muted-foreground">Eigenaren laden…</p>;

  return (
    <div className="space-y-3" data-testid="acquisitie-eigenaren-overzicht">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi label="CRM-eigenaren" value={totalen.eigenaren} />
        <Kpi label="Nog onbekend" value={totalen.onbekend} />
        <Kpi label="Open acties" value={totalen.openActies} />
        <Kpi label="Warme posities" value={totalen.warm} />
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Zoek eigenaar, object of target…"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
      </div>

      <section className="section-card divide-y divide-border/70 overflow-hidden">
        {gefilterd.length === 0 ? (
          <p className="px-5 py-10 text-sm text-muted-foreground">Geen eigenaren gevonden.</p>
        ) : gefilterd.map((groep) => (
          <article key={groep.key} className="p-4 space-y-3" data-testid="acquisitie-eigenaar-groep">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
                  {groep.relatieId ? (
                    <Link to={`/relaties/${groep.relatieId}`} className="font-medium text-sm hover:text-accent hover:underline truncate">
                      {groep.naam}
                    </Link>
                  ) : (
                    <span className="font-medium text-sm text-amber-700">{groep.naam}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {groep.targets.length} target{groep.targets.length === 1 ? '' : 's'} · {groep.objectIds.length} gekoppelde object{groep.objectIds.length === 1 ? '' : 'en'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Badge>{groep.openActies} open</Badge>
                {groep.verlopenActies > 0 && <Badge tone="danger">{groep.verlopenActies} verlopen</Badge>}
                {groep.warmePosities > 0 && <Badge tone="warm">{groep.warmePosities} warm</Badge>}
                {groep.eerstvolgendeActie && (
                  <Badge>
                    <CalendarClock className="h-3 w-3" /> {new Date(groep.eerstvolgendeActie).toLocaleDateString('nl-NL')}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {groep.targets.map((target) => (
                <Link
                  key={target.id}
                  to={`/acquisitie/targets/${target.id}`}
                  className="rounded-md border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors"
                >
                  <p className="text-xs font-medium truncate">{targetTitel(target)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">
                    {target.volgendeActieOmschrijving || target.redenInteressant || 'Geen volgende actie omschreven'}
                  </p>
                </Link>
              ))}
            </div>

            {groep.objectIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {groep.objectIds.map((id) => {
                  const object = objectMap.get(id);
                  if (!object) return null;
                  return (
                    <Button key={id} variant="outline" size="sm" asChild>
                      <Link to={`/objecten/${id}`}>
                        <Building2 className="h-3.5 w-3.5" />
                        {object.titel || object.adres || 'Open object'}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="section-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold font-mono-data">{value}</p>
    </div>
  );
}

function Badge({ children, tone = 'default' }: {
  children: React.ReactNode;
  tone?: 'default' | 'danger' | 'warm';
}) {
  const cls = tone === 'danger'
    ? 'border-destructive/30 bg-destructive/10 text-destructive'
    : tone === 'warm'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
      : 'border-border bg-muted/30 text-muted-foreground';
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${cls}`}>{children}</span>;
}
