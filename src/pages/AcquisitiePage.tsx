import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAcquisitie } from '@/hooks/useAcquisitie';
import { useDataStore } from '@/hooks/useDataStore';
import {
  ACQUISITIE_STATUS_LABEL, ACQUISITIE_STATUS_VOLGORDE,
  CAMPAGNE_KANAAL_LABEL, CAMPAGNE_STATUS_LABEL,
  targetIsActief, targetTitel,
  type AcquisitieStatus, type AcquisitieTarget,
} from '@/lib/acquisitie';
import AcquisitieStatusBadge from '@/components/acquisitie/AcquisitieStatusBadge';
import GeenActieBadge, { isVerlopen as datumVerlopen } from '@/components/GeenActieBadge';
import AcquisitieTargetFormDialog from '@/components/forms/AcquisitieTargetFormDialog';
import AcquisitieCampagneFormDialog from '@/components/forms/AcquisitieCampagneFormDialog';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';

type Tab = 'targets' | 'campagnes';

export default function AcquisitiePage() {
  const { targets, campagnes, laden } = useAcquisitie();
  const { getRelatieById, contactpersonen } = useDataStore();
  const [tab, setTab] = useState<Tab>('targets');
  const [zoek, setZoek] = useState('');
  const [statusFilter, setStatusFilter] = useState<AcquisitieStatus | ''>('');
  const [plaatsFilter, setPlaatsFilter] = useState('');
  const [campagneFilter, setCampagneFilter] = useState('');
  const [prioriteitFilter, setPrioriteitFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState('');
  const [targetForm, setTargetForm] = useState<{ open: boolean; target: AcquisitieTarget | null }>({ open: false, target: null });
  const [campagneForm, setCampagneForm] = useState<{ open: boolean; campagne: any }>({ open: false, campagne: null });

  const gefilterdeTargets = useMemo(() => {
    return targets.filter(t => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (plaatsFilter && !(t.plaats ?? '').toLowerCase().includes(plaatsFilter.toLowerCase())) return false;
      if (campagneFilter && t.campagneId !== campagneFilter) return false;
      if (prioriteitFilter && String(t.prioriteit) !== prioriteitFilter) return false;
      if (typeFilter && !(t.typeVastgoed ?? '').toLowerCase().includes(typeFilter.toLowerCase())) return false;
      if (zoek) {
        const q = zoek.toLowerCase();
        const blob = `${t.adres ?? ''} ${t.postcode ?? ''} ${t.plaats ?? ''} ${t.wijk ?? ''} ${t.notities ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [targets, zoek, statusFilter, plaatsFilter, campagneFilter, prioriteitFilter, typeFilter]);

  const campagneStats = useMemo(() => {
    const m = new Map<string, { total: number; reacties: number; warm: number; objecten: number }>();
    campagnes.forEach(c => m.set(c.id, { total: 0, reacties: 0, warm: 0, objecten: 0 }));
    targets.forEach(t => {
      if (!t.campagneId) return;
      const s = m.get(t.campagneId); if (!s) return;
      s.total++;
      if (t.status === 'reactie_ontvangen') s.reacties++;
      if (t.status === 'verkoopbereidheid_peilen' || t.status === 'potentiele_verkooppositie') s.warm++;
      if (t.status === 'object_aangemaakt') s.objecten++;
    });
    return m;
  }, [campagnes, targets]);

  const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5">
      <PageHeader
        title="Acquisitie"
        subtitle="Off-market targets en campagnes — vóór een pand aanbod wordt."
        actions={
          tab === 'targets' ? (
            <Button onClick={() => setTargetForm({ open: true, target: null })}>
              <Plus className="h-4 w-4 mr-1.5" /> Nieuwe target
            </Button>
          ) : (
            <Button onClick={() => setCampagneForm({ open: true, campagne: null })}>
              <Plus className="h-4 w-4 mr-1.5" /> Nieuwe campagne
            </Button>
          )
        }
      />

      <div className="flex gap-1 border-b border-border">
        {(['targets', 'campagnes'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === t ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t === 'targets' ? `Targets (${targets.length})` : `Campagnes (${campagnes.length})`}
          </button>
        ))}
      </div>

      {tab === 'targets' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="relative col-span-2 sm:col-span-3 lg:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Zoek op adres, plaats, notitie…" value={zoek} onChange={e => setZoek(e.target.value)} />
            </div>
            <select className={selectCls} value={statusFilter} onChange={e => setStatusFilter(e.target.value as AcquisitieStatus | '')}>
              <option value="">Alle statussen</option>
              {ACQUISITIE_STATUS_VOLGORDE.map(s => <option key={s} value={s}>{ACQUISITIE_STATUS_LABEL[s]}</option>)}
            </select>
            <Input placeholder="Plaats" value={plaatsFilter} onChange={e => setPlaatsFilter(e.target.value)} />
            <select className={selectCls} value={campagneFilter} onChange={e => setCampagneFilter(e.target.value)}>
              <option value="">Alle campagnes</option>
              {campagnes.map(c => <option key={c.id} value={c.id}>{c.naam}</option>)}
            </select>
            <div className="flex gap-2">
              <select className={`${selectCls} flex-1`} value={prioriteitFilter} onChange={e => setPrioriteitFilter(e.target.value)}>
                <option value="">Alle prio.</option>
                {[1,2,3,4,5].map(p => <option key={p} value={p}>P{p}</option>)}
              </select>
              <Input className="flex-1" placeholder="Type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} />
            </div>
          </div>

          <section className="section-card overflow-hidden">
            {laden ? (
              <p className="px-5 py-10 text-sm text-muted-foreground">Laden…</p>
            ) : gefilterdeTargets.length === 0 ? (
              <p className="px-5 py-10 text-sm text-muted-foreground">Geen targets gevonden.</p>
            ) : (
              <div className="divide-y divide-border/70">
                {gefilterdeTargets.map(t => {
                  const rel = t.relatieId ? getRelatieById(t.relatieId) : null;
                  const camp = t.campagneId ? campagnes.find(c => c.id === t.campagneId) : null;
                  const geenActie = !t.volgendeActieDatum && targetIsActief(t);
                  const verlopen = datumVerlopen(t.volgendeActieDatum) && targetIsActief(t);
                  return (
                    <Link key={t.id} to={`/acquisitie/targets/${t.id}`} className="block px-4 sm:px-5 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground truncate">{targetTitel(t)}</p>
                            <AcquisitieStatusBadge status={t.status} />
                            {verlopen ? <GeenActieBadge variant="verlopen" date={t.volgendeActieDatum} /> :
                              geenActie ? <GeenActieBadge /> : null}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {t.typeVastgoed ?? '—'}
                            {camp && ` · ${camp.naam}`}
                            {rel && ` · ${getRelatieNaamCompact(rel, contactpersonen)}`}
                            {` · P${t.prioriteit}`}
                          </p>
                        </div>
                        {t.volgendeActieDatum && (
                          <span className="text-xs text-muted-foreground font-mono-data shrink-0">
                            {new Date(t.volgendeActieDatum).toLocaleDateString('nl-NL')}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {tab === 'campagnes' && (
        <section className="section-card overflow-hidden">
          {campagnes.length === 0 ? (
            <p className="px-5 py-10 text-sm text-muted-foreground">Nog geen campagnes.</p>
          ) : (
            <div className="divide-y divide-border/70">
              {campagnes.map(c => {
                const s = campagneStats.get(c.id) ?? { total: 0, reacties: 0, warm: 0, objecten: 0 };
                return (
                  <Link key={c.id} to={`/acquisitie/campagnes/${c.id}`} className="block px-4 sm:px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{c.naam}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {CAMPAGNE_KANAAL_LABEL[c.kanaal]} · {CAMPAGNE_STATUS_LABEL[c.status]}
                          {c.gebied && ` · ${c.gebied}`}
                        </p>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground font-mono-data">
                        <span>{s.total} targets</span>
                        <span>{s.reacties} reacties</span>
                        <span>{s.warm} warm</span>
                        <span>{s.objecten} objecten</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      <AcquisitieTargetFormDialog
        open={targetForm.open}
        onOpenChange={(o) => setTargetForm({ open: o, target: o ? targetForm.target : null })}
        target={targetForm.target}
      />
      <AcquisitieCampagneFormDialog
        open={campagneForm.open}
        onOpenChange={(o) => setCampagneForm({ open: o, campagne: o ? campagneForm.campagne : null })}
        campagne={campagneForm.campagne}
      />
    </div>
  );
}
