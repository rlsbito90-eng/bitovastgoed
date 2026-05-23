// src/components/NotificationsBell.tsx
//
// Notificatie-bel in de topbar. Toont een persistent meldingenlog (localStorage)
// met read/unread status en beheer-acties (markeer als gelezen, wis, alles
// als gelezen, gelezen meldingen wissen).
//
// Bron: automatisch worden meldingen aangemaakt voor nieuwe matches met
// score >= 3. Latere uitbreidingen kunnen `pushNotification` importeren om
// extra meldingen toe te voegen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, Sparkles } from 'lucide-react';
import { useDataStore } from '@/hooks/useDataStore';
import { getAllMatchesFromData, ASSET_CLASS_LABELS } from '@/data/mock-data';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';

const STORAGE_KEY = 'bito-notifications-v1';
const SEEN_MATCH_KEYS = 'bito-notifications-seen-match-keys-v1';
const INIT_FLAG = 'bito-notifications-initialized-v1';
const DREMPEL = 3;

export type NotificationType = 'match' | 'system' | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  createdAt: number; // epoch ms
  read: boolean;
}

function loadAll(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveAll(list: AppNotification[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore quota
  }
}

function loadSeenMatchKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_MATCH_KEYS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSeenMatchKeys(set: Set<string>): void {
  try {
    localStorage.setItem(SEEN_MATCH_KEYS, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'zojuist';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} u`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

export default function NotificationsBell() {
  const store = useDataStore();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>(() => loadAll());
  const ref = useRef<HTMLDivElement>(null);

  // Bereken huidige matches om als bron te dienen voor notificaties.
  const matches = useMemo(() => {
    return getAllMatchesFromData(store.zoekprofielen, store.objecten)
      .filter((m) => m.score >= DREMPEL);
  }, [store.zoekprofielen, store.objecten]);

  // Genereer notificaties voor NIEUWE matches sinds laatst gezien.
  // Bij allereerste init: markeer bestaande matches als gezien zonder
  // notificaties te genereren (anders krijgt gebruiker meteen een vol log).
  useEffect(() => {
    const seen = loadSeenMatchKeys();
    const initialized = localStorage.getItem(INIT_FLAG) === '1';

    if (!initialized) {
      const all = new Set(matches.map((m) => `${m.objectId}::${m.zoekprofielId}`));
      saveSeenMatchKeys(all);
      try { localStorage.setItem(INIT_FLAG, '1'); } catch { /* ignore */ }
      return;
    }

    const nieuw = matches.filter(
      (m) => !seen.has(`${m.objectId}::${m.zoekprofielId}`)
    );
    if (nieuw.length === 0) return;

    setItems((prev) => {
      const existing = new Set(prev.map((n) => n.id));
      const toAdd: AppNotification[] = [];
      for (const m of nieuw) {
        const id = `match::${m.objectId}::${m.zoekprofielId}`;
        if (existing.has(id)) continue;
        const obj = store.getObjectById(m.objectId);
        const zp = store.zoekprofielen.find((z) => z.id === m.zoekprofielId);
        const rel = zp ? store.getRelatieById(zp.relatieId) : null;
        if (!obj || !zp || !rel) continue;
        toAdd.push({
          id,
          type: 'match',
          title: `Nieuwe match: ${obj.titel}`,
          body: `${getRelatieNaamCompact(rel, store.contactpersonen)} · ${zp.naam} · score ${m.score}/5`,
          href: `/objecten/${m.objectId}`,
          createdAt: Date.now(),
          read: false,
        });
      }
      if (toAdd.length === 0) return prev;
      const next = [...toAdd, ...prev].slice(0, 200);
      saveAll(next);
      return next;
    });

    const nextSeen = new Set(seen);
    for (const m of nieuw) nextSeen.add(`${m.objectId}::${m.zoekprofielId}`);
    saveSeenMatchKeys(nextSeen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  // Klik buiten popover sluit hem
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

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const markAsRead = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveAll(next);
      return next;
    });
  }, []);

  const removeOne = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((n) => n.id !== id);
      saveAll(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveAll(next);
      return next;
    });
  }, []);

  const clearRead = useCallback(() => {
    setItems((prev) => {
      const next = prev.filter((n) => !n.read);
      saveAll(next);
      return next;
    });
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-md hover:bg-muted transition-colors text-foreground"
        aria-label={unreadCount > 0 ? `${unreadCount} ongelezen meldingen` : 'Notificaties'}
        title="Notificaties"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold flex items-center justify-center font-mono-data">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[min(380px,calc(100vw-2rem))] bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Bell className="h-4 w-4 text-accent" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Notificaties</p>
              <p className="text-xs text-muted-foreground">
                {items.length === 0
                  ? 'Geen meldingen'
                  : unreadCount > 0
                    ? `${unreadCount} ongelezen · ${items.length} totaal`
                    : `${items.length} melding${items.length === 1 ? '' : 'en'}`}
              </p>
            </div>
          </div>

          {items.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/60 bg-muted/30">
              <button
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Alles als gelezen markeren"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Alles gelezen
              </button>
              <button
                onClick={clearRead}
                disabled={items.length === unreadCount}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
                title="Gelezen meldingen wissen"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Gelezen wissen
              </button>
            </div>
          )}

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Geen meldingen.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Nieuwe matches verschijnen hier automatisch.
              </p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto divide-y divide-border/60">
              {items.map((n) => {
                const Icon = n.type === 'match' ? Sparkles : Bell;
                const content = (
                  <div className="flex items-start gap-3 w-full">
                    <div className="relative mt-0.5 shrink-0">
                      <Icon className={`h-4 w-4 ${n.read ? 'text-muted-foreground' : 'text-accent'}`} />
                      {!n.read && (
                        <span
                          className="absolute -left-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-accent"
                          aria-label="Ongelezen"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${n.read ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {!n.read && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markAsRead(n.id);
                          }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Markeer als gelezen"
                          aria-label="Markeer als gelezen"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeOne(n.id);
                        }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                        title="Verwijderen"
                        aria-label="Verwijderen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );

                const baseClasses = `block pl-5 pr-3 py-3 transition-colors hover:bg-muted/40 ${
                  n.read ? '' : 'bg-accent/[0.04]'
                }`;

                return n.href ? (
                  <Link
                    key={n.id}
                    to={n.href}
                    onClick={() => {
                      markAsRead(n.id);
                      setOpen(false);
                    }}
                    className={baseClasses}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={n.id} className={baseClasses}>
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
