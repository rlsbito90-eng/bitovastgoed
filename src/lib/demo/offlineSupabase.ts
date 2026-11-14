/**
 * Offline PostgREST/Supabase simulator voor publieke Vercel-UI-previews.
 * GEEN API-verzoeken. Alle data is fictief en uitsluitend in browser-localStorage.
 * Beperkte demo-functionaliteit, geen productie-CRM en geen echte backendtests.
 */
type Row = Record<string, any>;
type Db = Record<string, Row[]>;
const PREFIX = 'bito.crm.offline-preview.v1';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const now = new Date().toISOString();
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const rid = '00000000-0000-4000-8000-000000000011';
const oid = '00000000-0000-4000-8000-000000000021';

function seededDb(): Db {
  return {
    user_roles: [{ id: '00000000-0000-4000-8000-000000000031', user_id: USER_ID, role: 'admin' }],
    relaties: [
      { id: rid, bedrijfsnaam: 'Voorbeeld Vastgoedgroep', contactpersoon: 'Demo Contact', type_partij: 'belegger', lead_status: 'actief', regio: ['Noord-Brabant'], asset_classes: ['wonen'], email: 'voorbeeld@example.invalid', created_at: now },
      { id: '00000000-0000-4000-8000-000000000012', bedrijfsnaam: 'Fictieve Ontwikkelaar BV', contactpersoon: 'Testpersoon', type_partij: 'ontwikkelaar', lead_status: 'warm', regio: ['Zuid-Holland'], asset_classes: ['mixed_use'], email: 'test@example.invalid', created_at: now },
    ],
    relatie_contactpersonen: [],
    objecten: [
      { id: oid, objectnaam: 'Voorbeeld woon- en winkelpand', adres: 'Demostraat 12', plaats: 'Voorbeeldstad', provincie: 'Noord-Brabant', type_vastgoed: 'winkels', status: 'beschikbaar', vraagprijs: 450000, huurinkomsten: 42000, verhuurstatus: 'verhuurd', ontwikkelpotentie: true, transformatiepotentie: true, is_archived: false, created_at: now },
      { id: '00000000-0000-4000-8000-000000000022', objectnaam: 'Fictief appartementencomplex', adres: 'Proeflaan 8', plaats: 'Testdorp', provincie: 'Zuid-Holland', type_vastgoed: 'wonen', status: 'te_beoordelen', vraagprijs: 795000, huurinkomsten: 62000, verhuurstatus: 'gedeeltelijk', ontwikkelpotentie: false, transformatiepotentie: false, is_archived: false, created_at: now },
    ],
    taken: [
      { id: '00000000-0000-4000-8000-000000000041', titel: 'Demo-eigenaar terugbellen', type: 'bellen', status: 'open', prioriteit: 'hoog', deadline: tomorrow, relatie_id: rid, created_at: now },
      { id: '00000000-0000-4000-8000-000000000042', titel: 'Fictieve propositie beoordelen', type: 'overig', status: 'open', prioriteit: 'normaal', deadline: tomorrow, object_id: oid, created_at: now },
    ],
    deals: [
      { id: '00000000-0000-4000-8000-000000000051', titel: 'Demo-transactie', relatie_id: rid, object_id: oid, fase: 'interesse', created_at: now },
    ],
    zoekprofielen: [],
    object_huurders: [], object_documenten: [], object_fotos: [], object_huur_metrics: [],
    deal_objecten: [], deal_kandidaten: [], jaar_doelen: [], referentie_objecten: [],
    deal_referenties: [], object_referenties: [], object_pipeline: [], pipelines: [],
    pipeline_stages: [], contact_moments: [],
  };
}

function readDb(): Db {
  if (typeof localStorage === 'undefined') return seededDb();
  try {
    const raw = localStorage.getItem(PREFIX);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Db;
    }
  } catch { /* privévensters met geblokkeerde opslag: gebruik tijdelijke data */ }
  return seededDb();
}

let memoryDb: Db | null = null;
function db(): Db {
  if (!memoryDb) memoryDb = readDb();
  return memoryDb;
}
function persist() {
  try { localStorage.setItem(PREFIX, JSON.stringify(db())); }
  catch { /* tijdelijke browsersessie blijft werken */ }
}
function nextId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type Filter = (row: Row) => boolean;
const eqValue = (actual: unknown, expected: unknown) => String(actual ?? '') === String(expected ?? '');

class Query {
  private filters: Filter[] = [];
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private patch: Row | Row[] | null = null;
  private max: number | null = null;
  private start = 0;
  private end: number | null = null;
  private sortBy: string | null = null;
  private asc = true;
  private singleMode: 'single' | 'maybeSingle' | null = null;

  constructor(private table: string) {}
  select(_columns = '*', _options?: unknown) { return this; }
  insert(value: Row | Row[]) { this.action = 'insert'; this.patch = value; return this; }
  update(value: Row) { this.action = 'update'; this.patch = value; return this; }
  upsert(value: Row | Row[], _options?: unknown) { this.action = 'upsert'; this.patch = value; return this; }
  delete() { this.action = 'delete'; return this; }
  eq(name: string, value: unknown) { this.filters.push(r => eqValue(r[name], value)); return this; }
  neq(name: string, value: unknown) { this.filters.push(r => !eqValue(r[name], value)); return this; }
  is(name: string, value: unknown) { this.filters.push(r => value === null ? r[name] == null : eqValue(r[name], value)); return this; }
  in(name: string, values: unknown[]) { this.filters.push(r => values.some(x => eqValue(r[name], x))); return this; }
  not(name: string, op: string, value: unknown) {
    if (op === 'is' && value === null) this.filters.push(r => r[name] != null);
    else if (op === 'in' && Array.isArray(value)) this.filters.push(r => !value.includes(r[name]));
    else this.filters.push(r => !eqValue(r[name], value));
    return this;
  }
  gt(name: string, value: unknown) { this.filters.push(r => r[name] > value); return this; }
  gte(name: string, value: unknown) { this.filters.push(r => r[name] >= value); return this; }
  lt(name: string, value: unknown) { this.filters.push(r => r[name] < value); return this; }
  lte(name: string, value: unknown) { this.filters.push(r => r[name] <= value); return this; }
  ilike(name: string, value: string) { const part = value.replace(/%/g, '').toLowerCase(); this.filters.push(r => String(r[name] ?? '').toLowerCase().includes(part)); return this; }
  like(name: string, value: string) { return this.ilike(name, value); }
  contains(name: string, value: unknown) { this.filters.push(r => Array.isArray(r[name]) && Array.isArray(value) && value.every(x => r[name].includes(x))); return this; }
  overlaps(name: string, value: unknown) { this.filters.push(r => Array.isArray(r[name]) && Array.isArray(value) && value.some(x => r[name].includes(x))); return this; }
  match(values: Row) { for (const [k, v] of Object.entries(values)) this.eq(k, v); return this; }
  or(_expression: string) { return this; }
  filter(_column: string, _operator: string, _value: unknown) { return this; }
  order(name: string, options?: { ascending?: boolean }) { this.sortBy = name; this.asc = options?.ascending !== false; return this; }
  limit(count: number) { this.max = count; return this; }
  range(start: number, end: number) { this.start = start; this.end = end + 1; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this; }
  csv() { return Promise.resolve(''); }
  explain() { return Promise.resolve({ data: null, error: null }); }
  private run() {
    const d = db();
    const rows = d[this.table] ?? (d[this.table] = []);
    const matches = (r: Row) => this.filters.every(f => f(r));
    let output: Row[] = [];
    if (this.action === 'select') output = rows.filter(matches);
    if (this.action === 'insert' || this.action === 'upsert') {
      const patches = Array.isArray(this.patch) ? this.patch : [this.patch ?? {}];
      output = patches.map(raw => {
        const entry: Row = { id: nextId(), created_at: new Date().toISOString(), ...raw };
        if (this.action === 'upsert') {
          const idx = rows.findIndex(x => eqValue(x.id, entry.id));
          if (idx >= 0) { rows[idx] = { ...rows[idx], ...entry }; return { ...rows[idx] }; }
        }
        rows.push(entry);
        return { ...entry };
      });
      persist();
    }
    if (this.action === 'update') {
      output = rows.filter(matches).map(row => Object.assign(row, this.patch as Row));
      persist();
    }
    if (this.action === 'delete') {
      output = rows.filter(matches);
      d[this.table] = rows.filter(row => !matches(row));
      persist();
    }
    if (this.sortBy) {
      const key = this.sortBy;
      output = [...output].sort((a, b) => {
        const x = a[key] ?? '';
        const y = b[key] ?? '';
        return (x > y ? 1 : x < y ? -1 : 0) * (this.asc ? 1 : -1);
      });
    }
    const total = output.length;
    output = output.slice(this.start, this.end ?? undefined);
    if (this.max != null) output = output.slice(0, this.max);
    if (this.singleMode) return { data: output[0] ?? null, error: null, count: total, status: 200 };
    return { data: output.map(row => ({ ...row })), error: null, count: total, status: 200 };
  }
  then(onFulfilled: (result: ReturnType<Query['run']>) => unknown, onRejected?: (error: unknown) => unknown) {
    return Promise.resolve(this.run()).then(onFulfilled, onRejected);
  }
}

const USER = {
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'demo@example.invalid',
  email_confirmed_at: now,
  is_anonymous: false,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Demo Gebruiker' },
  identities: [],
  created_at: now,
};
const SESSION = {
  access_token: 'offline-demo-token-not-valid-for-any-server',
  refresh_token: 'offline-demo-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 9999999999,
  user: USER,
};
const unsupported = async () => ({ data: null, error: new Error('Niet beschikbaar in de lokale previewdemo.') });

/** Deze simulator heeft geen verbinding met het internet en geen servergegevens. */
export const offlineDemoClient = {
  from: (table: string) => new Query(table),
  rpc: async (name: string) => {
    if (name === 'genereer_refnummer') return { data: `DEMO-${Date.now()}`, error: null };
    return { data: null, error: null };
  },
  auth: {
    onAuthStateChange: (cb: (event: string, session: typeof SESSION) => void) => {
      queueMicrotask(() => cb('INITIAL_SESSION', SESSION));
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    getSession: async () => ({ data: { session: SESSION }, error: null }),
    getUser: async () => ({ data: { user: USER }, error: null }),
    getClaims: async () => ({ data: { claims: { sub: USER_ID } }, error: null }),
    signOut: async () => ({ error: null }),
    signInWithPassword: unsupported,
    signInWithPasskey: unsupported,
    signInAnonymously: unsupported,
    signUp: unsupported,
    refreshSession: async () => ({ data: { session: SESSION, user: USER }, error: null }),
  },
  functions: { invoke: unsupported },
  storage: {
    from: (_bucket: string) => ({
      upload: unsupported, download: unsupported, remove: unsupported,
      list: async () => ({ data: [], error: null }),
      createSignedUrl: unsupported,
      createSignedUrls: unsupported,
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
  channel: () => ({
    on() { return this; },
    subscribe() { return this; },
    unsubscribe: async () => 'ok',
    send: async () => 'ok',
  }),
  removeChannel: async () => 'ok',
  removeAllChannels: async () => [],
  getChannels: () => [],
};
