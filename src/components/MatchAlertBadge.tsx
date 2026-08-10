// src/components/MatchAlertBadge.tsx
// Match-status is accountgebonden in Supabase; localStorage blijft alleen cache/fallback.

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useDataStore } from '@/hooks/useDataStore';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  getAllMatchesFromData,
  formatCurrencyCompact,
  ASSET_CLASS_LABELS,
} from '@/data/mock-data';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';
import { STRONG_MATCH_THRESHOLD, EXCELLENT_MATCH_THRESHOLD, isStrongMatch } from '@/lib/derivations';

const SEEN_KEYS_STORAGE = 'bito-matches-seen-keys-v2';
const SEEN_INIT_STORAGE = 'bito-matches-seen-initialized-v2';

function matchKey(objectId: string, zoekprofielId: string): string {
  return `${objectId}::${zoekprofielId}`;
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEYS_STORAGE);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSeen(set: Set<string>): void {
  try {
    localStorage.setItem(SEEN_KEYS_STORAGE, JSON.stringify([...set]));
    localStorage.setItem(SEEN_INIT_STORAGE, '1');
  } catch {
    // Cache is best-effort; Supabase is de bron voor ingelogde gebruikers.
  }
}

export default function MatchAlertBadge() {
  const store = useDataStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [seenKeys, setSeenKeys] = useState<Set<string>>(() => loadSeen());
  const [serverHydrated, setServerHydrated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const alle = getAllMatchesFromData(store.zoekprofielen, store.objecten);
    return alle
      .filter(m => isStrongMatch(m.score))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const zpA = store.zoekprofielen.find(z => z.id === a.zoekprofielId);
        const zpB = store.zoekprofielen.find(z => z.id === b.zoekprofielId);
        return (zpB?.prioriteit ?? 3) - (zpA?.prioriteit ?? 3);
      });
  }, [store.zoekprofielen, store.objecten]);

  // Hydrateer per account. Een bestaande lokale status wordt éénmalig meegenomen
  // als er nog geen serverstatus bestaat, zodat de huidige browser geen badges reset.
  useEffect(() => {
    let cancelled = false;
    setServerHydrated(false);

    async function hydrate() {
      if (!user) {
        if (!cancelled) {
          setSeenKeys(loadSeen());
          setServerHydrated(true);
        }
        return;
      }

      const { data, error } = await supabase
        .from('user_match_state')
        .select('seen_keys, initialized')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!error && data?.initialized) {
        const next = new Set<string>(Array.isArray(data.seen_keys) ? data.seen_keys : []);
        saveSeen(next);
        setSeenKeys(next);
        setServerHydrated(true);
        return;
      }

      const localInitialized = localStorage.getItem(SEEN_INIT_STORAGE) === '1';
      if (!localInitialized && matches.length === 0) return;

      const next = localInitialized
        ? loadSeen()
        : new Set(matches.map(m => matchKey(m.objectId, m.zoekprofielId)));

      saveSeen(next);
      setSeenKeys(next);

      const { error: upsertError } = await supabase
        .from('user_match_state')
        .upsert({
          user_id: user.id,
          seen_keys: [...next],
          initialized: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (!cancelled) setServerHydrated(!upsertError || true);
    }

    void hydrate();
    return () => { cancelled = true; };
  }, [user?.id, matches.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markeerAlsGezien = useCallback(() => {
    const next = new Set(matches.map(m => matchKey(m.objectId, m.zoekprofielId)));
    saveSeen(next);
    setSeenKeys(next);

    if (user) {
      void supabase
        .from('user_match_state')
        .upsert({
          user_id: user.id,
          seen_keys: [...next],
          initialized: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    }
  }, [matches, user]);

  const handleToggle = () => {
    if (!open) markeerAlsGezien();
    setOpen(o => !o);
  };

  const nieuweMatches = useMemo(
    () => serverHydrated ? matches.filter(m => !seenKeys.has(matchKey(m.objectId, m.zoekprofielId))) : [],
    [matches, seenKeys, serverHydrated],
  );

  const aantalNieuw = nieuweMatches.length;
  const aantalTotaal = matches.length;
  const top = matches.slice(0, 8);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-md hover:bg-muted transition-colors text-foreground"
        aria-label={aantalNieuw > 0 ? `${aantalNieuw} nieuwe match${aantalNieuw === 1 ? '' : 'es'}` : 'Matches'}
        title="Matches"
      >
        <Sparkles className="h-5 w-5" />
        {aantalNieuw > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold flex items-center justify-center font-mono-data">
            {aantalNieuw > 99 ? '99+' : aantalNieuw}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[min(380px,calc(100vw-2rem))] bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Matches</p>
              <p className="text-xs text-muted-foreground">
                {aantalTotaal === 0
                  ? 'Geen actuele matches'
                  : aantalNieuw > 0
                    ? `${aantalNieuw} nieuw · ${aantalTotaal} totaal (score ≥ ${STRONG_MATCH_THRESHOLD})`
                    : `${aantalTotaal} match${aantalTotaal === 1 ? '' : 'es'} (score ≥ ${STRONG_MATCH_THRESHOLD})`}
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
                          → {getRelatieNaamCompact(rel, store.contactpersonen)}
                          <span className="text-muted-foreground/60"> · {zp.naam}</span>
                        </p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono-data ${
                        m.score >= EXCELLENT_MATCH_THRESHOLD ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                        : m.score >= STRONG_MATCH_THRESHOLD ? 'bg-accent/15 text-accent'
                        : 'bg-muted text-muted-foreground'
                      }`}>
                        {m.score}/100
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
