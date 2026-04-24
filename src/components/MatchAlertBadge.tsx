// Bel-icoon in de header met tellertje voor het aantal match-paren met
// score >= 3. Klik = dropdown met top matches, klikbaar naar object-detail.
// Gebruikt de bestaande matching-engine in mock-data.ts (geen extra DB-werk).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Sparkles } from 'lucide-react';
import { useDataStore } from '@/hooks/useDataStore';
import {
  ASSET_CLASS_LABELS,
  formatCurrencyCompact,
  getAllMatchesFromData,
} from '@/data/mock-data';

const DREMPEL = 3;

export default function MatchAlertBadge() {
  const store = useDataStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  // Bereken alle matches met score >= drempel.
  // Sortering: hoogste score eerst, daarna op prioriteit van zoekprofiel.
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

  const aantal = matches.length;
  const top = matches.slice(0, 8);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-md hover:bg-muted transition-colors text-foreground"
        aria-label={`${aantal} match${aantal === 1 ? '' : 'es'}`}
      >
        <Bell className="h-5 w-5" />
        {aantal > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold flex items-center justify-center font-mono-data">
            {aantal > 99 ? '99+' : aantal}
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
                {aantal === 0
                  ? 'Geen actuele matches'
                  : `${aantal} object-zoekprofiel match${aantal === 1 ? '' : 'es'} (score ≥ ${DREMPEL})`}
              </p>
            </div>
          </div>

          {aantal === 0 ? (
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

                return (
                  <Link
                    key={`${m.objectId}-${m.zoekprofielId}-${i}`}
                    to={`/objecten/${m.objectId}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{obj.titel}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          → {rel.bedrijfsnaam}
                          <span className="text-muted-foreground/60"> · {zp.naam}</span>
                        </p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          m.score >= 5
                            ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                            : m.score >= 4
                            ? 'bg-accent/15 text-accent'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {m.score}/5
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>{ASSET_CLASS_LABELS[obj.type]}</span>
                      <span>
                        {obj.anoniem ? (obj.publiekeRegio ?? obj.provincie) : `${obj.plaats}, ${obj.provincie}`}
                      </span>
                      {obj.vraagprijs && (
                        <span className="font-mono-data">{formatCurrencyCompact(obj.vraagprijs)}</span>
                      )}
                    </div>
                  </Link>
                );
              })}
              {aantal > top.length && (
                <Link
                  to="/zoekprofielen"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 text-center text-xs text-accent hover:bg-muted/40 transition-colors"
                >
                  +{aantal - top.length} meer · alle matches bekijken
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
