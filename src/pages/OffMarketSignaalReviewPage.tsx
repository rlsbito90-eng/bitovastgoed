import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Keyboard, ListChecks } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import SignaalOnderzoeksacties from '@/components/offmarket/SignaalOnderzoeksacties';
import BagOverzichtKaart from '@/components/offmarket/bag/BagOverzichtKaart';
import SignaalAiAnalyse from '@/components/offmarket/SignaalAiAnalyse';
import {
  getListNavigation,
  loadListContext,
  saveListContext,
  updateListLastViewedId,
} from '@/lib/listNavigation';
import {
  PRIORITEIT_LABEL,
  PRIORITEIT_VOLGORDE,
  type OffMarketPrioriteit,
  type OffMarketStatus,
} from '@/lib/offMarket/types';
import {
  acquisitieSelectiePrioriteit,
  bepaalReviewPrioriteit,
} from '@/lib/offMarket/signaalReviewBeslissing';
import {
  useOffMarketSignaal,
  useOffMarketSignalen,
  useUpdateOffMarketSignaal,
} from '@/hooks/useOffMarketSignalen';
import { useVoegToeAanAcquisitieSelectie } from '@/hooks/useAcquisitieSelectie';

const LIJST_KEY = 'off-market-signalen';

const statusActies: Array<{ status: OffMarketStatus; label: string; toets: string; variant: 'outline' | 'default' }> = [
  { status: 'niet_interessant', label: 'Niet interessant', toets: '1', variant: 'outline' },
  { status: 'twijfel', label: 'Twijfel', toets: '2', variant: 'outline' },
  { status: 'te_onderzoeken', label: 'Onderzoeken', toets: '3', variant: 'outline' },
  { status: 'interessant', label: 'Interessant', toets: '4', variant: 'default' },
];

function waarde(value: unknown, suffix = ''): string {
  return value == null || value === '' ? '—' : `${String(value)}${suffix}`;
}

function isInvulElement(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

export default function OffMarketSignaalReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: signaal, isLoading, error } = useOffMarketSignaal(id);
  const { data: alleSignalen = [] } = useOffMarketSignalen();
  const update = useUpdateOffMarketSignaal();
  const voegToe = useVoegToeAanAcquisitieSelectie();
  const [bezigMet, setBezigMet] = useState<string | null>(null);
  const [gekozenPrioriteit, setGekozenPrioriteit] = useState<OffMarketPrioriteit>('laag');
  const [prioriteitHandmatig, setPrioriteitHandmatig] = useState(false);

  useEffect(() => {
    if (!signaal) return;
    setGekozenPrioriteit(signaal.prioriteit);
    setPrioriteitHandmatig(false);
  }, [signaal?.id, signaal?.prioriteit]);

  const fallbackWerkvoorraad = useMemo(
    () => alleSignalen.filter((item) => item.status === 'nieuw_signaal').map((item) => item.id),
    [alleSignalen],
  );

  const navInfo = useMemo(
    () => getListNavigation(LIJST_KEY, signaal?.id ?? '', fallbackWerkvoorraad),
    [signaal?.id, fallbackWerkvoorraad],
  );

  const gaNaar = (targetId: string | null) => {
    if (targetId) navigate(`/off-market/${targetId}?mode=review`);
  };

  const verwijderUitLokaleWerkvoorraad = (signaalId: string) => {
    const bestaand = loadListContext(LIJST_KEY) ?? fallbackWerkvoorraad;
    const index = bestaand.indexOf(signaalId);
    const volgendeIds = bestaand.filter((item) => item !== signaalId);
    saveListContext(LIJST_KEY, volgendeIds);
    return { bestaand, index, volgendeIds };
  };

  const herstelLokaleWerkvoorraad = (ids: string[]) => {
    saveListContext(LIJST_KEY, ids);
  };

  const gaDoorNaVerwijderen = (volgendeIds: string[], verwijderdeIndex: number) => {
    const volgendId = volgendeIds[Math.max(0, verwijderdeIndex)] ?? volgendeIds.at(-1) ?? null;
    if (volgendId) gaNaar(volgendId);
    else navigate('/off-market');
  };

  const wijzigStatus = async (status: OffMarketStatus) => {
    if (!signaal || bezigMet) return;
    const vorigeStatus = signaal.status;
    const vorigePrioriteit = signaal.prioriteit;
    const signaalId = signaal.id;
    const label = statusActies.find((item) => item.status === status)?.label ?? status;
    const nieuwePrioriteit = bepaalReviewPrioriteit({
      status,
      huidigePrioriteit: gekozenPrioriteit,
      handmatigAangepast: prioriteitHandmatig,
    });
    setBezigMet(status);
    try {
      await update.mutateAsync({ id: signaalId, patch: { status, prioriteit: nieuwePrioriteit } });
      const lokaleLijst = verwijderUitLokaleWerkvoorraad(signaalId);
      toast.success(`${label} · prioriteit ${PRIORITEIT_LABEL[nieuwePrioriteit]} · volgend signaal geopend.`, {
        duration: 8000,
        action: {
          label: 'Ongedaan maken',
          onClick: async () => {
            try {
              await update.mutateAsync({
                id: signaalId,
                patch: { status: vorigeStatus, prioriteit: vorigePrioriteit },
              });
              herstelLokaleWerkvoorraad(lokaleLijst.bestaand);
              toast.success('Vorige status en prioriteit hersteld.');
            } catch (e: any) {
              toast.error(e?.message ?? 'Herstellen mislukt.');
            }
          },
        },
      });
      gaDoorNaVerwijderen(lokaleLijst.volgendeIds, lokaleLijst.index);
    } catch (e: any) {
      toast.error(e?.message ?? 'Status wijzigen mislukt.');
    } finally {
      setBezigMet(null);
    }
  };

  const wijzigPrioriteit = (prioriteit: OffMarketPrioriteit) => {
    setGekozenPrioriteit(prioriteit);
    setPrioriteitHandmatig(true);
  };

  const voegToeAanSelectie = async () => {
    if (!signaal || bezigMet) return;
    const nieuwePrioriteit = acquisitieSelectiePrioriteit({
      huidigePrioriteit: gekozenPrioriteit,
      handmatigAangepast: prioriteitHandmatig,
    });
    setBezigMet('selectie');
    try {
      await voegToe.mutateAsync(signaal.id);
      if (signaal.status === 'nieuw_signaal') {
        await update.mutateAsync({
          id: signaal.id,
          patch: { status: 'interessant', prioriteit: nieuwePrioriteit },
        });
      } else if (signaal.prioriteit !== nieuwePrioriteit) {
        await update.mutateAsync({ id: signaal.id, patch: { prioriteit: nieuwePrioriteit } });
      }
      const lokaleLijst = verwijderUitLokaleWerkvoorraad(signaal.id);
      toast.success(`Toegevoegd aan Acquisitieselectie · status Interessant · prioriteit ${PRIORITEIT_LABEL[nieuwePrioriteit]}.`);
      gaDoorNaVerwijderen(lokaleLijst.volgendeIds, lokaleLijst.index);
    } catch (e: any) {
      toast.error(e?.message ?? 'Toevoegen aan acquisitieselectie mislukt.');
    } finally {
      setBezigMet(null);
    }
  };

  useEffect(() => {
    if (!signaal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isInvulElement(event.target) || event.metaKey || event.ctrlKey || event.altKey || bezigMet) return;
      const actie = statusActies.find((item) => item.toets === event.key);
      if (actie) {
        event.preventDefault();
        void wijzigStatus(actie.status);
        return;
      }
      if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        void voegToeAanSelectie();
      } else if (event.key === 'ArrowLeft' && navInfo.prevId) {
        event.preventDefault();
        gaNaar(navInfo.prevId);
      } else if (event.key === 'ArrowRight' && navInfo.nextId) {
        event.preventDefault();
        gaNaar(navInfo.nextId);
      } else if (event.key.toLowerCase() === 'g') {
        const adres = [signaal.adres, signaal.postcode, signaal.plaats].filter(Boolean).join(', ');
        if (adres) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`, '_blank', 'noopener,noreferrer');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [signaal, bezigMet, navInfo.prevId, navInfo.nextId, gekozenPrioriteit, prioriteitHandmatig]);

  if (isLoading) {
    return <div className="px-4 sm:px-6 py-6 text-sm text-muted-foreground">Signaal laden…</div>;
  }
  if (error || !signaal) {
    return (
      <div className="px-4 sm:px-6 py-6 space-y-3">
        <p className="text-sm text-destructive">Signaal niet gevonden.</p>
        <Button variant="outline" onClick={() => navigate('/off-market')}>Terug naar signalen</Button>
      </div>
    );
  }

  updateListLastViewedId(LIJST_KEY, signaal.id);
  const s = signaal as any;
  const adres = [signaal.adres, signaal.postcode, signaal.plaats].filter(Boolean).join(', ');

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 pb-44 md:pb-36 max-w-6xl space-y-4" data-testid="signaal-reviewmodus">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/off-market')}>
          <ArrowLeft className="h-4 w-4" /> Terug naar signalen
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!navInfo.prevId} onClick={() => gaNaar(navInfo.prevId)}>
            <ChevronLeft className="h-4 w-4" /> Vorige
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums min-w-24 text-center">
            {navInfo.index >= 0 ? `${navInfo.index + 1} van ${navInfo.total}` : `— van ${navInfo.total}`}
          </span>
          <Button variant="outline" size="sm" disabled={!navInfo.nextId} onClick={() => gaNaar(navInfo.nextId)}>
            Volgende <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <section className="section-card p-4 sm:p-5 space-y-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold leading-tight text-foreground">{signaal.titel}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{adres || 'Adres nog niet beschikbaar'}</p>
        </div>
        <div className="rounded-md border border-border/70 bg-muted/20 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Omschrijving</p>
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {signaal.omschrijving || 'Geen omschrijving beschikbaar.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Gemeente: <strong className="font-medium text-foreground">{waarde(s.geo_gemeente_naam ?? signaal.plaats)}</strong></span>
          <span>Wijk: <strong className="font-medium text-foreground">{waarde(s.geo_wijk_naam)}</strong></span>
          <span>Buurt: <strong className="font-medium text-foreground">{waarde(s.geo_buurt_naam)}</strong></span>
          <span>Strategie: <strong className="font-medium text-foreground">{waarde(signaal.potentiele_strategie)}</strong></span>
        </div>
      </section>

      <SignaalOnderzoeksacties signaal={signaal} />

      <section className="section-card p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Compacte pandcontext</h2>
          {s.bron_url && (
            <a href={s.bron_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
              Open bron <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ReviewStat label="Bouwjaar" value={waarde(s.bag_bouwjaar)} />
          <ReviewStat label="Aantal VBO's" value={waarde(s.bag_pandcontext_aantal_vbo ?? s.bag_aantal_vbo)} />
          <ReviewStat label="Totaal oppervlak" value={waarde(s.bag_pandcontext_totaal_opp_m2 ?? s.bag_totaal_oppervlakte_m2, ' m²')} />
          <ReviewStat label="Doelobject" value={waarde(s.bag_geselecteerd_opp_m2, ' m²')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          <p><span className="text-muted-foreground">Pandstatus:</span> {waarde(s.bag_pand_status)}</p>
          <p><span className="text-muted-foreground">Matchkwaliteit:</span> {waarde(s.bag_match_kwaliteit)}</p>
        </div>
      </section>

      {(s.ai_score != null || s.ai_samenvatting || s.ai_aanbevolen_actie) && (
        <details className="section-card p-4 sm:p-5 group">
          <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">AI-analyse</span>
            <span className="text-xs text-muted-foreground">
              Score {waarde(s.ai_score)} · Verkoopkans {waarde(s.ai_verkoopkans, '%')}
            </span>
          </summary>
          <div className="mt-4"><SignaalAiAnalyse signaal={signaal} /></div>
        </details>
      )}

      <details className="section-card p-4 sm:p-5">
        <summary className="cursor-pointer list-none text-sm font-semibold">Volledige BAG-context bekijken</summary>
        <div className="mt-4"><BagOverzichtKaart signaal={signaal} /></div>
      </details>

      <div className="fixed bottom-0 left-0 lg:left-[var(--sidebar-width,0px)] right-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur px-4 py-3 shadow-lg">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center gap-2">
          {statusActies.map((actie) => (
            <Button
              key={actie.status}
              size="sm"
              variant={actie.variant}
              disabled={bezigMet !== null}
              onClick={() => wijzigStatus(actie.status)}
              title={`Sneltoets ${actie.toets}`}
            >
              {bezigMet === actie.status ? 'Opslaan…' : `${actie.label} · ${actie.toets}`}
            </Button>
          ))}
          <select
            aria-label="Prioriteit"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={gekozenPrioriteit}
            onChange={(event) => wijzigPrioriteit(event.target.value as OffMarketPrioriteit)}
            disabled={bezigMet !== null}
            title={prioriteitHandmatig ? 'Handmatige prioriteit blijft leidend' : 'Wordt automatisch bepaald door de beoordeling'}
          >
            {PRIORITEIT_VOLGORDE.map((prioriteit) => (
              <option key={prioriteit} value={prioriteit}>{PRIORITEIT_LABEL[prioriteit]}</option>
            ))}
          </select>
          <div className="hidden xl:flex items-center gap-1 text-[11px] text-muted-foreground" title="Sneltoetsen: 1–4 status, A selectie, G Google Maps, pijlen navigatie">
            <Keyboard className="h-3.5 w-3.5" /> 1–4 · A · G · ← →
          </div>
          <Button className="ml-auto" size="sm" disabled={bezigMet !== null} onClick={voegToeAanSelectie} title="Sneltoets A">
            <ListChecks className="h-4 w-4" />
            {bezigMet === 'selectie' ? 'Toevoegen…' : 'Naar acquisitieselectie · A'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
