// Focusmodus voor de Off-Market Acquisitieselectie.
// Eén signaal tegelijk; iedere verwerksessie is automatisch hervatbaar.
// Geen automatische dossierwijzigingen of automatische Kadasterbestellingen.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Check, ChevronLeft, ExternalLink, FileSearch, Mail, SkipForward,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  OffMarketStatusBadge, OffMarketAiStatusBadge,
} from '@/components/offmarket/OffMarketBadges';
import { BagKaartBadge } from '@/components/offmarket/kaart/KaartSignaalBadges';
import {
  ReadinessBadge, WaarschuwingBadges,
} from './ReadinessBadge';
import FocusWerkInhoud from './FocusWerkInhoud';
import BulkKadasterWizard from './BulkKadasterWizard';
import { cleanAdres, cleanPlaats, formatSignaalAdres } from '@/lib/offMarket/adresNormalisatie';
import {
  SIGNAALTYPE_LABEL, type OffMarketSignaal,
} from '@/lib/offMarket/types';
import type { SignaalReadiness } from '@/lib/offMarket/acquisitie/readiness';
import { bepaalFocusContext } from '@/lib/offMarket/acquisitie/focusContext';
import ToevoegenAanAcquisitieSelectieKnop from './ToevoegenAanAcquisitieSelectieKnop';
import {
  eerstVolgendeId,
  leesWerkronde,
  markeerBehandeld,
  markeerOvergeslagen,
  schrijfWerkronde,
  startWerkronde,
  voortgang,
  voortgangTekst,
  wisWerkronde,
  zetPositie,
  type Werkronde,
} from '@/lib/offMarket/acquisitie/werkronde';

export interface FocusItem {
  signaal: OffMarketSignaal;
  readiness: SignaalReadiness;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: FocusItem[];
  index: number;
  onIndexChange: (i: number) => void;
  /** Scope-IDs van de actieve verwerk-sessie. `null` = volledige lijst. */
  focusScopeIds?: string[] | null;
  /** IDs die in Acquisitieselectie aangevinkt zijn. */
  selectedIds?: string[];
}

function tekstType(s: OffMarketSignaal): string {
  return (SIGNAALTYPE_LABEL as Record<string, string>)[s.type_signaal] ?? s.type_signaal ?? '—';
}

function volledigBehandeld(ronde: Werkronde): boolean {
  const behandeld = new Set(ronde.behandeldeIds);
  return ronde.scopeIds.every((id) => behandeld.has(id));
}

function kanHervatten(ronde: Werkronde, aangevraagdeIds: string[]): boolean {
  if (volledigBehandeld(ronde)) return false;
  const aangevraagd = new Set(aangevraagdeIds);
  return ronde.scopeIds.every((id) => aangevraagd.has(id));
}

export default function FocusModus({
  open,
  onClose,
  items,
  index,
  onIndexChange,
  focusScopeIds,
  selectedIds,
}: Props) {
  const navigate = useNavigate();
  const [werkronde, setWerkronde] = useState<Werkronde | null>(() => leesWerkronde());
  const [bulkKadasterOpen, setBulkKadasterOpen] = useState(false);
  const [vasteFasePerSignaal, setVasteFasePerSignaal] = useState<Record<string, SignaalReadiness['fase']>>({});

  const beschikbareIds = useMemo(
    () => items.map((item) => item.signaal.id),
    [items],
  );

  const bulkKadasterSignalen = useMemo(() => {
    const doelIds = selectedIds?.length
      ? new Set(selectedIds)
      : focusScopeIds?.length
        ? new Set(focusScopeIds)
        : new Set(beschikbareIds);
    return items
      .filter((item) => doelIds.has(item.signaal.id))
      .map((item) => item.signaal);
  }, [items, selectedIds, focusScopeIds, beschikbareIds]);

  const werkrondeBeschikbareIds = useMemo(() => {
    if (!werkronde) return beschikbareIds;
    const scope = new Set(werkronde.scopeIds);
    return beschikbareIds.filter((id) => scope.has(id));
  }, [beschikbareIds, werkronde]);

  const veiligIndex = useMemo(() => {
    if (items.length === 0) return 0;
    if (index < 0) return 0;
    if (index >= items.length) return items.length - 1;
    return index;
  }, [items.length, index]);

  const huidigVoorFase = items[veiligIndex] ?? null;
  const huidigVoorFaseId = huidigVoorFase?.signaal.id ?? null;

  useEffect(() => {
    if (!open) {
      setVasteFasePerSignaal({});
      return;
    }
    if (!huidigVoorFaseId || !huidigVoorFase) return;
    setVasteFasePerSignaal((prev) => {
      if (prev[huidigVoorFaseId]) return prev;
      return { ...prev, [huidigVoorFaseId]: huidigVoorFase.readiness.fase };
    });
    // Bewust niet afhankelijk van readiness.fase: de actieve werkstap blijft
    // tijdens deze Focus-kaart staan totdat de gebruiker Gereed → volgende kiest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, huidigVoorFaseId]);

  const bewaarWerkronde = (volgende: Werkronde) => {
    setWerkronde(volgende);
    schrijfWerkronde(volgende);
  };

  const rondWerkrondeAf = () => {
    wisWerkronde();
    setWerkronde(null);
    toast.success('Werkronde afgerond');
    onClose();
  };

  useEffect(() => {
    if (!open || beschikbareIds.length === 0) return;

    const opgeslagen = leesWerkronde();
    const aangevraagdeIds = focusScopeIds?.length ? focusScopeIds : beschikbareIds;
    const hervatOpgeslagen = Boolean(opgeslagen && kanHervatten(opgeslagen, aangevraagdeIds));
    const ronde = hervatOpgeslagen && opgeslagen
      ? opgeslagen
      : startWerkronde({
          bron: selectedIds?.length ? 'handmatig' : 'werkbak',
          naam: selectedIds?.length
            ? `Geselecteerde signalen (${aangevraagdeIds.length})`
            : `Verwerk selectie (${aangevraagdeIds.length})`,
          scopeIds: aangevraagdeIds,
        });

    const rondeIds = beschikbareIds.filter((id) => ronde.scopeIds.includes(id));
    const explicietGekozenId = beschikbareIds[veiligIndex] ?? null;
    const volgendeId = hervatOpgeslagen
      ? (
          eerstVolgendeId(ronde, rondeIds)
          ?? (ronde.huidigeId && rondeIds.includes(ronde.huidigeId) ? ronde.huidigeId : null)
          ?? rondeIds[0]
          ?? beschikbareIds[0]
        )
      : (
          explicietGekozenId && rondeIds.includes(explicietGekozenId)
            ? explicietGekozenId
            : (rondeIds[0] ?? beschikbareIds[0])
        );
    const volgendeIndex = Math.max(0, beschikbareIds.indexOf(volgendeId));
    const bijgewerkt = zetPositie(ronde, volgendeId);

    bewaarWerkronde(bijgewerkt);
    if (volgendeIndex !== index) onIndexChange(volgendeIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, beschikbareIds.join('|')]);

  const vorigeLengte = useRef(items.length);
  useEffect(() => {
    if (!open) {
      vorigeLengte.current = items.length;
      return;
    }
    if (items.length === 0) {
      onClose();
    } else if (vorigeLengte.current > items.length && index >= items.length) {
      onIndexChange(Math.max(0, items.length - 1));
    }
    vorigeLengte.current = items.length;
  }, [items.length, index, open, onClose, onIndexChange]);

  const gaNaarVolgendeResterende = (ronde: Werkronde) => {
    if (volledigBehandeld(ronde)) {
      rondWerkrondeAf();
      return;
    }

    const scope = new Set(ronde.scopeIds);
    const rondeIds = beschikbareIds.filter((id) => scope.has(id));
    const volgendeId = eerstVolgendeId(ronde, rondeIds);
    if (!volgendeId) {
      bewaarWerkronde(zetPositie(ronde, null));
      onClose();
      return;
    }
    const volgendeIndex = beschikbareIds.indexOf(volgendeId);
    const bijgewerkt = zetPositie(ronde, volgendeId);
    bewaarWerkronde(bijgewerkt);
    onIndexChange(volgendeIndex >= 0 ? volgendeIndex : 0);
  };

  const markeerHuidigBehandeld = () => {
    if (!werkronde || items.length === 0) return;
    const id = items[veiligIndex].signaal.id;
    if (!werkronde.scopeIds.includes(id)) return;
    const bijgewerkt = markeerBehandeld(werkronde, id);
    gaNaarVolgendeResterende(bijgewerkt);
  };

  const slaHuidigOver = () => {
    if (!werkronde || items.length === 0) return;
    const id = items[veiligIndex].signaal.id;
    if (!werkronde.scopeIds.includes(id)) return;
    const bijgewerkt = markeerOvergeslagen(werkronde, id);
    gaNaarVolgendeResterende(bijgewerkt);
  };

  const sluitEnBewaar = () => {
    if (werkronde && items.length > 0) {
      const id = items[veiligIndex].signaal.id;
      if (werkronde.scopeIds.includes(id)) {
        bewaarWerkronde(zetPositie(werkronde, id));
      }
    }
    onClose();
  };

  const voortgangInfo = werkronde ? voortgang(werkronde) : null;

  if (!open || items.length === 0) return null;

  const huidig = items[veiligIndex];
  const { signaal, readiness } = huidig;
  const vasteFase = vasteFasePerSignaal[signaal.id] ?? readiness.fase;
  const focusContext = bepaalFocusContext(vasteFase);
  const readinessIsDoorgestroomd = vasteFase !== readiness.fase;
  const adres = formatSignaalAdres(signaal) || cleanAdres(signaal.adres) || '—';
  const plaats = cleanPlaats(signaal.plaats) || '';
  const positieInWerkronde = Math.max(0, werkrondeBeschikbareIds.indexOf(signaal.id));
  const kanNaarBrieven = focusContext.context === 'onderzoeken'
    && readiness.geadresseerden.some((g) =>
      !!(g.naam || g.bedrijfsnaam) && g.volledigPostadres,
    );

  const goVorige = () => {
    if (positieInWerkronde <= 0) return;
    const vorigeId = werkrondeBeschikbareIds[positieInWerkronde - 1];
    const vorigeIndex = beschikbareIds.indexOf(vorigeId);
    if (vorigeIndex >= 0) onIndexChange(vorigeIndex);
  };

  const openDetail = (tab = focusContext.tab) => {
    navigate(
      `/off-market/${signaal.id}?mode=normaal&tab=${tab}`,
      {
        state: {
          fromAcquisitieFocus: true,
          focusIndex: veiligIndex,
          focusScopeIds: werkronde?.scopeIds ?? focusScopeIds ?? null,
          selectedIds: selectedIds ?? [],
          focusTab: tab,
        },
      },
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) sluitEnBewaar(); }}>
        <DialogContent
          data-testid="focus-modus"
          data-focus-context={focusContext.context}
          className="
            p-0 gap-0
            sm:max-w-4xl
            max-sm:!fixed max-sm:!inset-0 max-sm:!w-screen max-sm:!h-[100dvh]
            max-sm:!max-w-none max-sm:!translate-x-0 max-sm:!translate-y-0
            max-sm:!left-0 max-sm:!top-0 max-sm:!rounded-none
            flex flex-col overflow-hidden
          "
        >
          <DialogTitle className="sr-only">{focusContext.titel}</DialogTitle>
          <DialogDescription className="sr-only">
            Focusmodus voor de acquisitieselectie. {focusContext.instructie}
          </DialogDescription>

          <div
            data-testid="focus-header"
            className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60 bg-background/85 backdrop-blur"
          >
            <div className="min-w-0 pr-8 flex-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0 shrink-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Focus · {positieInWerkronde + 1} van {werkrondeBeschikbareIds.length}
                  </p>
                  <h2 className="text-sm font-medium text-foreground truncate">{focusContext.titel}</h2>
                </div>
                <div className="min-w-0 sm:text-right" data-testid="focus-onderwerp-adres">
                  <p className="text-sm font-semibold text-foreground truncate" title={adres}>{adres}</p>
                  {plaats && (
                    <p className="text-[11px] text-muted-foreground truncate" title={plaats}>{plaats}</p>
                  )}
                </div>
              </div>
              {voortgangInfo && (
                <p className="mt-1 text-[11px] text-muted-foreground" data-testid="focus-werkronde-voortgang">
                  {voortgangTekst(voortgangInfo)}
                </p>
              )}
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            style={{ paddingBottom: 'calc(7.5rem + env(safe-area-inset-bottom))' }}
            data-testid="focus-body"
          >
            <section className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-muted/40 text-muted-foreground whitespace-nowrap">
                  {tekstType(signaal)}
                </span>
                <OffMarketStatusBadge status={signaal.status} />
                <OffMarketAiStatusBadge status={signaal.ai_status} />
                {(signaal as any).bag_status && <BagKaartBadge signaal={signaal} size="sm" />}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-3 space-y-2">
              <p className="text-xs font-medium text-foreground" data-testid="focus-context-instructie">
                {focusContext.instructie}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <ReadinessBadge fase={readiness.fase} />
                <span className="text-xs text-muted-foreground">{readiness.info.reden}</span>
              </div>
              {readinessIsDoorgestroomd && (
                <p className="text-xs text-emerald-700" data-testid="focus-doorgestroomd-melding">
                  Deze stap is inhoudelijk afgerond. Volgende stap: {readiness.info.volgendeActie}. Je blijft hier totdat je Gereed → volgende kiest.
                </p>
              )}
              {readiness.blokkadeReden && (
                <p className="text-xs text-destructive" data-testid="focus-blokkade">
                  {readiness.blokkadeReden}
                </p>
              )}
              <WaarschuwingBadges waarschuwingen={readiness.waarschuwingen} max={6} />
              <p className="text-xs text-muted-foreground">
                Volgende actie: <span className="text-foreground">{readiness.info.volgendeActie}</span>
              </p>
            </section>

            <FocusWerkInhoud signaal={signaal} focusContext={focusContext} />

            <section className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Geadresseerden ({readiness.telling.totaal})
              </p>
              <ul className="space-y-1" data-testid="focus-geadresseerden">
                {readiness.geadresseerden.length === 0 && (
                  <li className="text-xs text-muted-foreground">Nog geen geadresseerden bekend.</li>
                )}
                {readiness.geadresseerden.map(g => (
                  <li key={g.key} className="text-xs text-foreground break-words">
                    <span className="font-medium">
                      {g.naam || g.bedrijfsnaam || '(onbekende geadresseerde)'}
                    </span>
                    {g.bedrijfsnaam && g.naam && (
                      <span className="text-muted-foreground"> — {g.bedrijfsnaam}</span>
                    )}
                    {!g.volledigPostadres && !g.heeftEmailVerzonden && (
                      <span className="ml-1 text-[10px] text-amber-700">· adres onvolledig</span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[11px] text-muted-foreground">
                <span>Volledig adres: {readiness.telling.metVolledigAdres}</span>
                <span>Actief concept: {readiness.telling.metActiefConcept}</span>
                <span>Printklaar: {readiness.telling.gereedVoorPrint}</span>
                <span>Geprint/gepost: {readiness.telling.geprintOfGepost}</span>
              </div>
            </section>
          </div>

          <div
            data-testid="focus-footer"
            className="sticky bottom-0 left-0 right-0 border-t border-border/60 bg-background/85 backdrop-blur"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex flex-wrap gap-2 px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openDetail()}
                data-testid="focus-open-signaal"
              >
                <ExternalLink className="h-4 w-4" />
                Open signaal
              </Button>
              {bulkKadasterSignalen.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setBulkKadasterOpen(true)}
                  data-testid="focus-bulk-kadaster"
                >
                  <FileSearch className="h-4 w-4" />
                  Kadaster voor selectie ({bulkKadasterSignalen.length})
                </Button>
              )}
              {kanNaarBrieven && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openDetail('brieven')}
                  data-testid="focus-naar-brieven"
                >
                  <Mail className="h-4 w-4" />
                  Naar Brieven &amp; opvolging
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goVorige}
                disabled={positieInWerkronde <= 0}
                data-testid="focus-vorige"
              >
                <ChevronLeft className="h-4 w-4" />
                Vorige
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={slaHuidigOver}
                data-testid="focus-overslaan"
              >
                <SkipForward className="h-4 w-4" />
                Later behandelen
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={markeerHuidigBehandeld}
                data-testid="focus-volgende"
              >
                <Check className="h-4 w-4" />
                Gereed → volgende
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={sluitEnBewaar}
                data-testid="focus-sluiten"
              >
                Sluiten en later doorgaan
              </Button>
              <div className="w-full flex justify-center pt-1">
                <ToevoegenAanAcquisitieSelectieKnop
                  signaalId={signaal.id}
                  variant="compact"
                  labelMode="remove"
                  isInSelectie
                  className="min-h-0 h-8 border-0 bg-transparent px-2 text-[11px] font-normal text-muted-foreground shadow-none hover:bg-muted/50 hover:text-foreground"
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BulkKadasterWizard
        open={bulkKadasterOpen}
        onClose={() => setBulkKadasterOpen(false)}
        onResultaatClose={() => {
          setBulkKadasterOpen(false);
          sluitEnBewaar();
        }}
        signalen={bulkKadasterSignalen}
      />
    </>
  );
}
