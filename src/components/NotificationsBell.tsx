// src/components/NotificationsBell.tsx
//
// Notificatie-bel in de topbar. Toont een persistent meldingenlog
// (localStorage) met:
// - read/unread status + beheer-acties (markeer / wis / alles gelezen)
// - datum + tijd per melding (compact, met relatieve hint)
// - basis voor type (taak/deal/bieding/dossier/matching/systeem)
// - basis voor prioriteit (laag/normaal/hoog/kritiek)
// - optionele contextlink (href) voor klik-doorverwijzing
//
// Sortering: ongelezen > prioriteit (kritiek..laag) > nieuwste eerst.
//
// === BEPERKTE TRIGGERS ===
// Alleen de hieronder genoemde situaties veroorzaken meldingen.
// Hierbuiten wordt nooit automatisch een melding aangemaakt om
// notificatie-overload te voorkomen.
//
// 1. Taken
//    - Taak met hoge/urgente prioriteit nieuw aangemaakt  → 'hoog'
//    - Taakdeadline is vandaag (open/in uitvoering/wacht) → 'hoog'
//    - Taak is verlopen                                   → 'kritiek'
// 2. Biedingen
//    - Bod verloopt vandaag of morgen (status actief)     → 'hoog'
// 3. Matching
//    - Nieuwe sterke match (score ≥ STRONG_MATCH_THRESHOLD, 0–100) → 'normaal'
// 4. Systeem / datakwaliteit
//    - Mogelijke dubbele relatie                          → 'kritiek'
//    - Mogelijke dubbele objectinvoer                     → 'kritiek'
//
// Externe modules kunnen via `pushNotification` extra meldingen
// toevoegen, maar dit gebeurt bewust spaarzaam.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Sparkles,
  CheckSquare,
  Briefcase,
  Gavel,
  FolderOpen,
  AlertTriangle,
} from 'lucide-react';
import { useDataStore } from '@/hooks/useDataStore';
import { useBiedingen } from '@/hooks/useBiedingen';
import { getAllMatchesFromData, type Relatie, type ObjectVastgoed, type Taak } from '@/data/mock-data';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';
import { isTaakTeLaat, isTaakVandaag } from '@/lib/taakHelpers';
import { isStrongMatch } from '@/lib/derivations';

const STORAGE_KEY = 'bito-notifications-v2';
const CREATED_IDS_KEY = 'bito-notifications-created-ids-v1';
const INIT_FLAG = 'bito-notifications-initialized-v3';
// Sterke-match drempel komt uit centrale matching helper (0–100 schaal).
const MAX_NOTIFICATIONS = 200;
const MAX_CREATED_IDS = 2000;

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'taak'
  | 'deal'
  | 'bieding'
  | 'dossier'
  | 'matching'
  | 'systeem';

export type NotificationPriority = 'laag' | 'normaal' | 'hoog' | 'kritiek';

export type NotificationContextKind =
  | 'object'
  | 'relatie'
  | 'deal'
  | 'bieding'
  | 'taak'
  | 'document';

export interface NotificationContext {
  kind: NotificationContextKind;
  id: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body?: string;
  href?: string;
  context?: NotificationContext;
  createdAt: number; // epoch ms
  read: boolean;
}

const TYPE_LABEL: Record<NotificationType, string> = {
  taak: 'Taak',
  deal: 'Dealflow',
  bieding: 'Bieding',
  dossier: 'Dossier',
  matching: 'Matching',
  systeem: 'Systeem',
};

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  taak: CheckSquare,
  deal: Briefcase,
  bieding: Gavel,
  dossier: FolderOpen,
  matching: Sparkles,
  systeem: AlertTriangle,
};

const PRIORITY_RANK: Record<NotificationPriority, number> = {
  kritiek: 4,
  hoog: 3,
  normaal: 2,
  laag: 1,
};

// ── Storage helpers ──────────────────────────────────────────────────────────

function loadAll(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((n: Partial<AppNotification> & { id: string; title: string; createdAt: number }) => ({
      id: n.id,
      type: (n.type as NotificationType) ?? 'systeem',
      priority: (n.priority as NotificationPriority) ?? 'normaal',
      title: n.title,
      body: n.body,
      href: n.href,
      context: n.context,
      createdAt: n.createdAt,
      read: Boolean(n.read),
    }));
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

function loadCreatedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(CREATED_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveCreatedIds(set: Set<string>): void {
  try {
    // Cap om localStorage niet te laten groeien zonder limiet.
    const arr = [...set];
    const trimmed = arr.length > MAX_CREATED_IDS ? arr.slice(arr.length - MAX_CREATED_IDS) : arr;
    localStorage.setItem(CREATED_IDS_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

// ── Public API: laat andere modules een melding toevoegen ────────────────────

export function pushNotification(
  n: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & {
    id?: string;
    createdAt?: number;
    read?: boolean;
  },
): void {
  const id = n.id ?? `${n.type}::${Date.now()}::${Math.random().toString(36).slice(2, 8)}`;
  const created = loadCreatedIds();
  if (created.has(id)) return;
  const list = loadAll();
  if (list.some((x) => x.id === id)) return;
  const item: AppNotification = {
    id,
    type: n.type,
    priority: n.priority,
    title: n.title,
    body: n.body,
    href: n.href,
    context: n.context,
    createdAt: n.createdAt ?? Date.now(),
    read: n.read ?? false,
  };
  const next = [item, ...list].slice(0, MAX_NOTIFICATIONS);
  saveAll(next);
  created.add(id);
  saveCreatedIds(created);
  try {
    window.dispatchEvent(new CustomEvent('bito:notifications-updated'));
  } catch {
    // ignore
  }
}

// ── Datum/tijd formatting ────────────────────────────────────────────────────

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  const tijd = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDay) return `Vandaag ${tijd}`;
  if (isYesterday) return `Gisteren ${tijd}`;

  const maanden = [
    'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
    'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
  ];
  const sameYear = d.getFullYear() === now.getFullYear();
  const datum = sameYear
    ? `${d.getDate()} ${maanden[d.getMonth()]}`
    : `${d.getDate()} ${maanden[d.getMonth()]} ${d.getFullYear()}`;
  return `${datum} · ${tijd}`;
}

function relativeHint(ts: number): string | null {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'zojuist';
  if (m < 60) return `${m} min geleden`;
  return null;
}

// ── Duplicate detectors ──────────────────────────────────────────────────────

function norm(s?: string | null): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function detectRelatieDuplicates(relaties: Relatie[]): Array<{ key: string; groep: Relatie[] }> {
  const groups = new Map<string, Relatie[]>();
  for (const r of relaties) {
    if (r.softDeletedAt) continue;
    const keys: string[] = [];
    const email = norm(r.email);
    const tel = norm(r.telefoon).replace(/[^\d+]/g, '');
    const kvk = norm(r.kvkNummer);
    const naam = norm(r.bedrijfsnaam);
    if (email) keys.push(`email:${email}`);
    if (tel && tel.length >= 8) keys.push(`tel:${tel}`);
    if (kvk) keys.push(`kvk:${kvk}`);
    if (naam) keys.push(`naam:${naam}`);
    for (const k of keys) {
      const arr = groups.get(k) ?? [];
      arr.push(r);
      groups.set(k, arr);
    }
  }
  const out: Array<{ key: string; groep: Relatie[] }> = [];
  for (const [key, groep] of groups) {
    const uniek = Array.from(new Map(groep.map((g) => [g.id, g])).values());
    if (uniek.length >= 2) out.push({ key, groep: uniek });
  }
  return out;
}

function detectObjectDuplicates(objecten: ObjectVastgoed[]): Array<{ key: string; groep: ObjectVastgoed[] }> {
  const groups = new Map<string, ObjectVastgoed[]>();
  for (const o of objecten) {
    const keys: string[] = [];
    const adres = norm(o.adres);
    const pc = norm(o.postcode).replace(/\s+/g, '');
    const plaats = norm(o.plaats);
    const ref = norm(o.internReferentienummer);
    const titel = norm(o.titel);
    if (adres && pc) keys.push(`adres:${adres}|${pc}`);
    else if (adres && plaats) keys.push(`adres:${adres}|${plaats}`);
    if (ref) keys.push(`ref:${ref}`);
    if (titel && plaats) keys.push(`titel:${titel}|${plaats}`);
    for (const k of keys) {
      const arr = groups.get(k) ?? [];
      arr.push(o);
      groups.set(k, arr);
    }
  }
  const out: Array<{ key: string; groep: ObjectVastgoed[] }> = [];
  for (const [key, groep] of groups) {
    const uniek = Array.from(new Map(groep.map((g) => [g.id, g])).values());
    if (uniek.length >= 2) out.push({ key, groep: uniek });
  }
  return out;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function NotificationsBell() {
  const store = useDataStore();
  const { items: biedingen } = useBiedingen({ all: true });
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>(() => loadAll());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setItems(loadAll());
    window.addEventListener('bito:notifications-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('bito:notifications-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  // Bron-derived candidate notificaties berekenen.
  const matches = useMemo(
    () => getAllMatchesFromData(store.zoekprofielen, store.objecten).filter((m) => isStrongMatch(m.score)),
    [store.zoekprofielen, store.objecten],
  );

  const taken = store.taken;
  const relaties = store.relaties;
  const objecten = store.objecten;

  // Hoofd-synchronisatie effect. Genereert max één nieuwe melding per
  // unieke kandidaat-id; reeds eerder aangemaakte ids worden overgeslagen
  // ook als de gebruiker ze al gewist heeft.
  useEffect(() => {
    const created = loadCreatedIds();
    const initialized = localStorage.getItem(INIT_FLAG) === '1';
    const now = new Date();
    const dayKey = todayKey(now);

    const candidates: AppNotification[] = [];

    // 1. Taken
    for (const t of taken) {
      if (t.softDeletedAt) continue;
      if (t.status === 'afgerond' || t.status === 'geannuleerd') continue;

      // 1a. Verlopen
      if (isTaakTeLaat(t, now)) {
        candidates.push({
          id: `taak-verlopen::${t.id}`,
          type: 'taak',
          priority: 'kritiek',
          title: `Taak verlopen: ${t.titel}`,
          body: t.deadline ? `Deadline ${t.deadline}${t.deadlineTijd ? ` ${t.deadlineTijd.slice(0, 5)}` : ''}` : undefined,
          href: '/taken',
          context: { kind: 'taak', id: t.id },
          createdAt: Date.now(),
          read: false,
        });
        continue; // verlopen overschaduwt "vandaag"
      }

      // 1b. Vandaag
      if (isTaakVandaag(t, now)) {
        candidates.push({
          id: `taak-vandaag::${t.id}::${dayKey}`,
          type: 'taak',
          priority: 'hoog',
          title: `Taak vandaag: ${t.titel}`,
          body: t.deadlineTijd ? `Vandaag ${t.deadlineTijd.slice(0, 5)}` : 'Vandaag',
          href: '/taken',
          context: { kind: 'taak', id: t.id },
          createdAt: Date.now(),
          read: false,
        });
      }

      // 1c. Nieuw aangemaakt met hoge/urgente prioriteit
      if (t.prioriteit === 'hoog' || t.prioriteit === 'urgent') {
        candidates.push({
          id: `taak-hoogprio::${t.id}`,
          type: 'taak',
          priority: 'hoog',
          title: `Nieuwe ${t.prioriteit === 'urgent' ? 'urgente' : 'hoog-prioriteit'}taak: ${t.titel}`,
          body: t.deadline ? `Deadline ${t.deadline}` : undefined,
          href: '/taken',
          context: { kind: 'taak', id: t.id },
          createdAt: Date.now(),
          read: false,
        });
      }
    }

    // 2. Biedingen — bod verloopt vandaag of morgen
    const ACTIEVE_BOD_STATUS = new Set([
      'concept', 'ontvangen', 'in_behandeling', 'tegenvoorstel_gedaan', 'aangepast_bod_gevraagd',
    ]);
    for (const b of biedingen) {
      if (!b.geldigTot) continue;
      if (!ACTIEVE_BOD_STATUS.has(b.status)) continue;
      const [y, m, d] = String(b.geldigTot).slice(0, 10).split('-').map(Number);
      if (!y) continue;
      const gt = new Date(y, m - 1, d);
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const diffDagen = Math.round((gt.getTime() - start.getTime()) / 86400000);
      if (diffDagen === 0 || diffDagen === 1) {
        const obj = store.getObjectById(b.objectId);
        candidates.push({
          id: `bod-verloop::${b.id}::${String(b.geldigTot).slice(0, 10)}`,
          type: 'bieding',
          priority: 'hoog',
          title: diffDagen === 0 ? 'Bod verloopt vandaag' : 'Bod verloopt morgen',
          body: obj ? `${obj.titel} · geldig tot ${String(b.geldigTot).slice(0, 10)}` : `Geldig tot ${String(b.geldigTot).slice(0, 10)}`,
          href: obj ? `/objecten/${obj.id}` : undefined,
          context: { kind: 'bieding', id: b.id },
          createdAt: Date.now(),
          read: false,
        });
      }
    }

    // 3. Matching — sterke match
    for (const m of matches) {
      const obj = store.getObjectById(m.objectId);
      const zp = store.zoekprofielen.find((z) => z.id === m.zoekprofielId);
      const rel = zp ? store.getRelatieById(zp.relatieId) : null;
      if (!obj || !zp || !rel) continue;
      candidates.push({
        id: `match-sterk::${m.objectId}::${m.zoekprofielId}`,
        type: 'matching',
        priority: 'normaal',
        title: `Sterke match: ${obj.titel}`,
        body: `${getRelatieNaamCompact(rel, store.contactpersonen)} · ${zp.naam} · score ${m.score}/100`,
        href: `/objecten/${m.objectId}`,
        context: { kind: 'object', id: m.objectId },
        createdAt: Date.now(),
        read: false,
      });
    }

    // 4. Datakwaliteit — dubbele relaties
    for (const dup of detectRelatieDuplicates(relaties)) {
      const namen = dup.groep.slice(0, 3).map((r) => r.bedrijfsnaam || r.contactpersoon || 'Onbekend').join(', ');
      const reden = dup.key.split(':')[0];
      const redenLabel = reden === 'email' ? 'zelfde e-mail'
        : reden === 'tel' ? 'zelfde telefoonnummer'
        : reden === 'kvk' ? 'zelfde KvK-nummer'
        : 'gelijke bedrijfsnaam';
      candidates.push({
        id: `dupe-relatie::${dup.key}`,
        type: 'systeem',
        priority: 'kritiek',
        title: 'Mogelijke dubbele relatie',
        body: `${namen} (${redenLabel})`,
        href: `/relaties/${dup.groep[0].id}`,
        context: { kind: 'relatie', id: dup.groep[0].id },
        createdAt: Date.now(),
        read: false,
      });
    }

    // 4b. Datakwaliteit — dubbele objecten
    for (const dup of detectObjectDuplicates(objecten)) {
      const titels = dup.groep.slice(0, 3).map((o) => o.titel).join(', ');
      const reden = dup.key.split(':')[0];
      const redenLabel = reden === 'adres' ? 'zelfde adres'
        : reden === 'ref' ? 'zelfde intern referentienummer'
        : 'gelijke titel + plaats';
      candidates.push({
        id: `dupe-object::${dup.key}`,
        type: 'systeem',
        priority: 'kritiek',
        title: 'Mogelijke dubbele objectinvoer',
        body: `${titels} (${redenLabel})`,
        href: `/objecten/${dup.groep[0].id}`,
        context: { kind: 'object', id: dup.groep[0].id },
        createdAt: Date.now(),
        read: false,
      });
    }

    // Eerste init: markeer alle huidige kandidaten als 'al gezien' zodat
    // de gebruiker niet wordt overspoeld door historische data.
    if (!initialized) {
      const next = new Set(created);
      for (const c of candidates) next.add(c.id);
      saveCreatedIds(next);
      try { localStorage.setItem(INIT_FLAG, '1'); } catch { /* ignore */ }
      return;
    }

    const nieuw = candidates.filter((c) => !created.has(c.id));
    if (nieuw.length === 0) return;

    setItems((prev) => {
      const existing = new Set(prev.map((n) => n.id));
      const toAdd = nieuw.filter((n) => !existing.has(n.id));
      if (toAdd.length === 0) return prev;
      const next = [...toAdd, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveAll(next);
      return next;
    });

    const nextCreated = new Set(created);
    for (const c of nieuw) nextCreated.add(c.id);
    saveCreatedIds(nextCreated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken, biedingen, matches, relaties, objecten]);

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

  // Sorteer: ongelezen > prioriteit > nieuwste
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      const p = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      if (p !== 0) return p;
      return b.createdAt - a.createdAt;
    });
  }, [items]);

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
        <div className="absolute right-0 top-full mt-1 w-[min(400px,calc(100vw-2rem))] bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
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
                Alleen kritieke gebeurtenissen verschijnen hier.
              </p>
            </div>
          ) : (
            <div className="max-h-[440px] overflow-y-auto divide-y divide-border/60">
              {sorted.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                const isHighPri = n.priority === 'hoog' || n.priority === 'kritiek';
                const showPriChip = !n.read && isHighPri;
                const rel = relativeHint(n.createdAt);

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
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium bg-muted text-muted-foreground">
                          {TYPE_LABEL[n.type]}
                        </span>
                        {showPriChip && (
                          <span
                            className={`inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium ${
                              n.priority === 'kritiek'
                                ? 'bg-destructive/15 text-destructive'
                                : 'bg-accent/15 text-accent'
                            }`}
                          >
                            {n.priority === 'kritiek' ? 'Kritiek' : 'Hoog'}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm truncate ${n.read ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono-data">
                        {formatDateTime(n.createdAt)}
                        {rel ? ` · ${rel}` : ''}
                      </p>
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
