// src/components/MatchAlertBadge.tsx
//
// Bel-icoon in de header met tellertje voor NIEUWE matches sinds de laatste
// keer dat de bel is geopend. Werkt als Gmail/WhatsApp:
//
// - Bel-icoon staat altijd in de header (klikbaar voor overzicht)
// - Tellertje toont alleen matches die JONGER zijn dan de "laatst gezien" tijd
// - Klik op de bel = "gezien" → tellertje weg
// - Komt later een nieuwe match bij → tellertje verschijnt opnieuw
//
// Tracking via localStorage zodat de status persistent is per browser/device.
// Drempel: matches met score >= 3.

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Sparkles } from 'lucide-react';
import { useDataStore } from '@/hooks/useDataStore';
import {
  getAllMatchesFromData,
  formatCurrencyCompact,
  ASSET_CLASS_LABELS,
} from '@/data/mock-data';

const DREMPEL = 3;
const LAATST_GEZIEN_KEY = 'bito-matches-laatst-gezien';

// Bepaalt of een match "nieuw" is sinds laatst-gezien tijd.
// Een match telt als nieuw als het object OF het zoekprofiel is bewerkt
// na het laatst-gezien moment.
function isMatchNieuw(
  objectUpdatedAt: string | undefined,
  zoekprofielUpdatedAt: string | undefined,
  laatstGezien: number,
): boolean {
  const objTime = objectUpdatedAt ? new Date(objectUpdatedAt).getTime() : 0;
  const zpTime = zoekprofielUpdatedAt ? new Date(zoekprofielUpdatedAt).getTime() : 0;
  const meestRecent = Math.max(objTime, zpTime);
  return meestRecent > laatstGezien;
}

export default function MatchAlertBadge() {
  const store = useDataStore();
  const [open, setOpen] = useState(false);
  const [laatstGezien, setLaatstGezien] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);

  // Laad laatst-gezien tijd uit localStorage bij mount
  useEffect(() => {
    try {
      const v = localStorage.getItem(LAATST_GEZIEN_KEY);
      setLaatstGezien(v ? parseInt(v, 10) : 0);
    } catch {
      // localStorage kan geblokkeerd zijn (private browsing) — dan altijd 0
      setLaatstGezien(0);
    }
  }, []);

  // Sluit dropdown bij klik buiten
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Markeer matches als gezien zodra de bel wordt geopend
  const markeerAlsGezien = useCallback(() => {
    const nu = Date.now();
    try {
      localStorage.setItem(LAATST_GEZIEN_KEY, String(nu));
    } catch {
      // private browsing — geen probleem, in-memory state werkt nog
    }
    setLaatstGezien(nu);
  }, []);

  const handleToggle = () => {
    if (!open) {
      // Bij openen: direct markeren als gezien (badge verdwijnt)
      markeerAlsGezien();
    }
    setOpen(o => !o);
  };

  // Bereken alle matches met score >= drempel.
  // Gesorteerd: hoogste score eerst, dan op zoekprofiel-prioriteit.
  const matches = useMemo(() => {
    const alle = getAllMatchesFromData(store.zoekprofielen, store.objecten);
    return alle
      .filter(m => m.score >= DREMPEL)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const zpA = store.zoekprofielen.find(z => z.id === a.zoekprofielId);
        const zpB = store.zoekprofielen.find(z => z.id === b.zoekprofielId);
        return (zpB?.prioriteit ?? 3) - (zpA?.prioriteit ?? 3);
      });
  }, [store.zoekprofielen, store.objecten]);

  // Bepaal welke matches NIEUW zijn (voor het tellertje)
  const nieuweMatches = useMemo(() => {
    if (laatstGezien === 0) {
      // Eerste keer (geen localStorage waarde): toon alleen matches uit
      // de laatste 7 dagen om niet bij eerste gebruik direct te beginnen
      // met "30 nieuwe matches" als de hele history wordt geteld.
      const zevenDagenGeleden = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return matches.filter(m => {
        const obj = store.getObjectById(m.objectId);
        const zp = store.zoekprofielen.find(z => z.id === m.zoekprofielId);
        return isMatchNieuw(obj?.updatedAt, zp?.updatedAt, zevenDagenGeleden);
      });
    }
    return matches.filter(m => {
      const obj = store.getObjectById(m.objectId);
      const zp = store.zoekprofielen.find(z => z.id === m.zoekprofielId);
      return isMatchNieuw(obj?.updatedAt, zp?.updatedAt, laatstGezien);
    });
  }, [matches, laatstGezien, store]);

  const aantalNieuw = nieuweMatches.length;
  const aantalTotaal = matches.length;
  const top = matches.slice(0, 8);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-md hover:bg-muted transition-colors text-foreground"
        aria-label={aantalNieuw > 0 ? `${aantalNieuw} nieuwe match${aantalNieuw === 1 ? '' : 'es'}` : 'Matches bekijken'}
      >
        <Bell className="h-5 w-5" />
        {aantalNieuw > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold flex items-center justify-center font-mono-data">
            {aantalNieuw > 99 ? '99+' : aantalNieuw}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[min(380px,calc(100vw-2rem))] bg-card border border-border rounded-md shadow-lg z-40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Matches</p>
              <p className="text-xs text-muted-foreground">
                {aantalTotaal === 0
                  ? 'Geen actuele matches'
                  : aantalNieuw > 0
                    ? `${aantalNieuw} nieuw · ${aantalTotaal} totaal (score ≥ ${DREMPEL})`
                    : `${aantalTotaal} match${aantalTotaal === 1 ? '' : 'es'} (score ≥ ${DREMPEL})`
                }
              </p>
            </div>
          </div>

          {aantalTotaal === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Voeg objecten of zoekprofielen toe — matches verschijnen automatisch.
              </p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto divide-y divide-border/60">
              {top.map((m, i) => {
                const obj = store.getObjectById(m.objectId);
                const zp = store.zoekprofielen.find(z => z.id === m.zoekprofielId);
                const rel = zp ? store.getRelatieById(zp.relatieId) : null;
                if (!obj || !zp || !rel) return null;

                // Markeer of deze match nieuw is sinds laatst-gezien
                const wasNieuw = nieuweMatches.some(nm =>
                  nm.objectId === m.objectId && nm.zoekprofielId === m.zoekprofielId
                );

                return (
                  <Link
                    key={`${m.objectId}-${m.zoekprofielId}-${i}`}
                    to={`/objecten/${m.objectId}`}
                    onClick={() => setOpen(false)}
                    className={`block pl-5 pr-4 py-3 hover:bg-muted/40 transition-colors relative ${
                      wasNieuw ? 'bg-accent/[0.04]' : ''
                    }`}
                  >
                    {wasNieuw && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-accent" aria-label="Nieuw" />
                    )}
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{obj.titel}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          → {rel.bedrijfsnaam}
                          <span className="text-muted-foreground/60"> · {zp.naam}</span>
                        </p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        m.score >= 5 ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                        : m.score >= 4 ? 'bg-accent/15 text-accent'
                        : 'bg-muted text-muted-foreground'
                      }`}>
                        {m.score}/5
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>{ASSET_CLASS_LABELS[obj.type]}</span>
                      <span>{obj.anoniem ? (obj.publiekeRegio ?? obj.provincie) : obj.plaats}</span>
                      {obj.vraagprijs && <span className="font-mono-data">{formatCurrencyCompact(obj.vraagprijs)}</span>}
                    </div>
                  </Link>
                );
              })}
              {aantalTotaal > top.length && (
                <Link
                  to="/zoekprofielen"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 text-center text-xs text-accent hover:bg-muted/40 transition-colors"
                >
                  +{aantalTotaal - top.length} meer · alle matches bekijken
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
