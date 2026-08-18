import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing, Check, CheckCheck, Loader2, Smartphone, Trash2 } from 'lucide-react';
import {
  dismissNotification,
  listNotificationEvents,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotificationChanges,
  type ServerNotificationEvent,
} from '@/lib/notifications/repository';
import { enablePushForThisDevice, getPushCapability } from '@/lib/notifications/pushClient';
import TaskReminderDefaultSetting from '@/components/notifications/TaskReminderDefaultSetting';
import { toast } from 'sonner';

function formatDateTime(value: string): string {
  const d = new Date(value);
  return d.toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pushLabel() {
  const c = getPushCapability();
  if (!c.supported) return 'Push niet ondersteund';
  if (c.platform === 'iOS/iPadOS' && c.displayMode !== 'standalone') return 'Open via beginscherm voor push';
  if (c.permission === 'granted') return 'Push actief op dit apparaat';
  if (c.permission === 'denied') return 'Push geblokkeerd';
  return 'Push aanzetten op dit apparaat';
}

export default function NotificationsBellV2() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ServerNotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState(() => pushLabel());

  const reload = useCallback(async () => {
    try {
      const next = await listNotificationEvents({ limit: 200 });
      setItems(next);
    } catch (error) {
      console.error('Servernotificaties laden mislukt', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    let unsubscribe: (() => void) | undefined;
    void subscribeToNotificationChanges(() => void reload()).then((fn) => { unsubscribe = fn; });
    // Geplande events bestaan al vóór scheduled_at en worden daarom niet opnieuw
    // door Realtime gewijzigd op het activatiemoment. Een lichte minuutrefresh houdt
    // de in-app bel gelijk aan de serverplanning; push blijft server-driven.
    const timer = window.setInterval(() => void reload(), 60_000);
    return () => {
      unsubscribe?.();
      window.clearInterval(timer);
    };
  }, [reload]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read_at).length, [items]);
  const sorted = useMemo(() => [...items].sort((a, b) => {
    if (Boolean(a.read_at) !== Boolean(b.read_at)) return a.read_at ? 1 : -1;
    const rank: Record<string, number> = { kritiek: 4, hoog: 3, normaal: 2, laag: 1 };
    const prio = (rank[b.priority] ?? 0) - (rank[a.priority] ?? 0);
    if (prio !== 0) return prio;
    const aTime = a.scheduled_at ?? a.created_at;
    const bTime = b.scheduled_at ?? b.created_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  }), [items]);

  async function readOne(id: string) {
    await markNotificationRead(id);
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n));
  }

  async function dismissOne(id: string) {
    await dismissNotification(id);
    setItems((prev) => prev.filter((n) => n.id !== id));
  }

  async function readAll() {
    await markAllNotificationsRead();
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
  }

  async function enablePush() {
    const capability = getPushCapability();
    if (capability.platform === 'iOS/iPadOS' && capability.displayMode !== 'standalone') {
      toast.info('Open Bito CRM via het beginscherm om pushmeldingen op deze iPhone te activeren.');
      return;
    }
    if (capability.permission === 'denied') {
      toast.error('Pushmeldingen zijn voor Bito CRM geblokkeerd in de apparaatinstellingen.');
      return;
    }

    setPushBusy(true);
    try {
      const label = [capability.platform, capability.browser, capability.displayMode === 'standalone' ? 'webapp' : 'browser']
        .filter(Boolean)
        .join(' · ');
      await enablePushForThisDevice(label);
      setPushStatus('Push actief op dit apparaat');
      toast.success('Pushmeldingen zijn op dit apparaat geactiveerd.');
    } catch (error: any) {
      toast.error(error?.message ?? 'Pushmeldingen activeren mislukt');
      setPushStatus(pushLabel());
    } finally {
      setPushBusy(false);
    }
  }

  const capability = getPushCapability();
  const canAttemptPush = capability.supported && capability.permission !== 'denied';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-muted transition-colors text-foreground"
        aria-label={unreadCount ? `${unreadCount} ongelezen meldingen` : 'Notificaties'}
        title="Notificaties"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[min(420px,calc(100vw-2rem))] bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <BellRing className="h-4 w-4 text-accent" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Notificaties</p>
              <p className="text-xs text-muted-foreground">
                {loading ? 'Laden…' : unreadCount ? `${unreadCount} ongelezen · synchroon op alle apparaten` : 'Alles bijgewerkt'}
              </p>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-border/60 bg-muted/20 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void enablePush()}
              disabled={pushBusy || !canAttemptPush || capability.permission === 'granted'}
              className="flex min-w-0 items-center gap-1.5 rounded px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60 disabled:cursor-default"
            >
              {pushBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
              <span className="truncate">{pushStatus}</span>
            </button>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => void readAll()}
                disabled={unreadCount === 0}
                className="ml-auto flex items-center gap-1 rounded px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Alles gelezen
              </button>
            )}
          </div>

          <TaskReminderDefaultSetting />

          {loading ? (
            <div className="px-4 py-10 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Geen actieve meldingen.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Registratiedata zonder actie-intentie verschijnen hier niet.</p>
            </div>
          ) : (
            <div className="max-h-[460px] overflow-y-auto divide-y divide-border/60">
              {sorted.map((n) => {
                const body = (
                  <div className={`flex gap-3 px-4 py-3 hover:bg-muted/40 ${n.read_at ? '' : 'bg-accent/[0.04]'}`}>
                    <div className="pt-1">
                      <span className={`block h-2 w-2 rounded-full ${n.read_at ? 'bg-muted-foreground/30' : 'bg-accent'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm truncate ${n.read_at ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>{n.title}</p>
                        {(n.priority === 'hoog' || n.priority === 'kritiek') && (
                          <span className={`shrink-0 rounded px-1.5 py-px text-[10px] ${n.priority === 'kritiek' ? 'bg-destructive/15 text-destructive' : 'bg-accent/15 text-accent'}`}>
                            {n.priority === 'kritiek' ? 'Kritiek' : 'Hoog'}
                          </span>
                        )}
                      </div>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground truncate">{n.body}</p>}
                      <p className="mt-1 text-[10px] text-muted-foreground/70">{formatDateTime(n.scheduled_at ?? n.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-start gap-0.5">
                      {!n.read_at && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); void readOne(n.id); }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          aria-label="Markeer als gelezen"
                          title="Markeer als gelezen"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); void dismissOne(n.id); }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                        aria-label="Melding verbergen"
                        title="Melding verbergen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );

                return n.href ? (
                  <Link key={n.id} to={n.href} onClick={() => { void readOne(n.id); setOpen(false); }}>
                    {body}
                  </Link>
                ) : <div key={n.id}>{body}</div>;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}