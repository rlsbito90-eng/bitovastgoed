import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'bito-notifications-v2';
const CREATED_IDS_KEY = 'bito-notifications-created-ids-v1';
const SYNC_EVENT = 'bito:notifications-updated';

let installed = false;
let currentUserId: string | null = null;
let hydrating = false;
let lastFingerprint = '';
let debounceTimer: number | null = null;

function readLocal() {
  let items: unknown[] = [];
  let createdIds: string[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    items = [];
  }
  try {
    const raw = localStorage.getItem(CREATED_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    createdIds = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    createdIds = [];
  }
  return { items, createdIds };
}

function fingerprint(state = readLocal()): string {
  return JSON.stringify([state.items, state.createdIds]);
}

function writeLocal(items: unknown[], createdIds: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  localStorage.setItem(CREATED_IDS_KEY, JSON.stringify(createdIds));
}

async function pushLocalToServer() {
  if (!currentUserId || hydrating) return;
  const state = readLocal();
  const fp = fingerprint(state);
  if (fp === lastFingerprint) return;

  // Nieuwe tabellen zijn nog niet in de gegenereerde Database-types opgenomen.
  // Runtime-RLS blijft leidend; cast is tijdelijk tot de types opnieuw gegenereerd worden.
  const db = supabase as any;
  const { error } = await db
    .from('user_notification_state')
    .upsert({
      user_id: currentUserId,
      items: state.items,
      created_ids: state.createdIds,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (!error) lastFingerprint = fp;
}

function schedulePush() {
  if (debounceTimer != null) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    void pushLocalToServer();
  }, 250);
}

async function hydrate(userId: string) {
  hydrating = true;
  currentUserId = userId;
  const db = supabase as any;
  const { data, error } = await db
    .from('user_notification_state')
    .select('items, created_ids')
    .eq('user_id', userId)
    .maybeSingle();

  if (!error && data) {
    const items = Array.isArray(data.items) ? data.items : [];
    const createdIds = Array.isArray(data.created_ids) ? data.created_ids : [];
    writeLocal(items, createdIds);
    lastFingerprint = fingerprint({ items, createdIds });
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  } else if (!data) {
    const local = readLocal();
    const { error: upsertError } = await db
      .from('user_notification_state')
      .upsert({
        user_id: userId,
        items: local.items,
        created_ids: local.createdIds,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (!upsertError) lastFingerprint = fingerprint(local);
  }

  hydrating = false;
}

export function installNotificationStateSync() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  void supabase.auth.getSession().then(({ data }) => {
    const id = data.session?.user.id ?? null;
    if (id) void hydrate(id);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    const id = session?.user.id ?? null;
    if (!id) {
      currentUserId = null;
      lastFingerprint = '';
      return;
    }
    if (id !== currentUserId) void hydrate(id);
  });

  window.addEventListener(SYNC_EVENT, schedulePush);
  window.addEventListener('storage', schedulePush);
  window.addEventListener('pagehide', () => { void pushLocalToServer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void pushLocalToServer();
    } else if (currentUserId) {
      // Bij terugkeer eerst server opnieuw laden, zodat een ander apparaat leidend blijft.
      void hydrate(currentUserId);
    }
  });

  // Vangt ook acties op die alleen localStorage aanpassen en geen custom event sturen.
  window.setInterval(() => {
    if (!currentUserId || hydrating) return;
    if (fingerprint() !== lastFingerprint) schedulePush();
  }, 1500);
}
