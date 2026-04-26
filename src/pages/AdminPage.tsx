import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useDataStore } from '@/hooks/useDataStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, User as UserIcon, Loader2, Target, Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatCurrency } from '@/data/mock-data';
import type { JaarDoel } from '@/data/mock-data';
import FeedTokensSectie from '@/components/admin/FeedTokensSectie';

type Rol = 'admin' | 'medewerker';

interface GebruikerRow {
  id: string;
  email: string;
  volledige_naam: string | null;
  created_at: string;
  rollen: Rol[];
}

export default function AdminPage() {
  const { user: huidigeGebruiker } = useAuth();
  const store = useDataStore();
  const [gebruikers, setGebruikers] = useState<GebruikerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    setLoading(true);
    const [profielenRes, rollenRes] = await Promise.all([
      supabase.from('profiles').select('id, email, volledige_naam, created_at').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
    ]);

    if (profielenRes.error) {
      toast.error('Profielen laden mislukt');
      setLoading(false);
      return;
    }

    const rollenPerUser = new Map<string, Rol[]>();
    (rollenRes.data ?? []).forEach((r: any) => {
      const huidig = rollenPerUser.get(r.user_id) ?? [];
      huidig.push(r.role);
      rollenPerUser.set(r.user_id, huidig);
    });

    const rijen: GebruikerRow[] = (profielenRes.data ?? []).map((p: any) => ({
      id: p.id,
      email: p.email,
      volledige_naam: p.volledige_naam,
      created_at: p.created_at,
      rollen: rollenPerUser.get(p.id) ?? [],
    }));
    setGebruikers(rijen);
    setLoading(false);
  }, []);

  useEffect(() => { laden(); }, [laden]);

  const rolToekennen = async (userId: string, rol: Rol) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: rol });
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Rol is al toegekend' : `Fout: ${error.message}`);
      return;
    }
    toast.success(`Rol '${rol}' toegekend`);
    laden();
  };

  const rolIntrekken = async (userId: string, rol: Rol) => {
    if (userId === huidigeGebruiker?.id && rol === 'admin') {
      toast.error('Je kunt jezelf niet de adminrol ontnemen');
      return;
    }
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', rol);
    if (error) {
      toast.error(`Fout: ${error.message}`);
      return;
    }
    toast.success(`Rol '${rol}' ingetrokken`);
    laden();
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8 fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Beheer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Jaardoelen en gebruikerstoegang.
        </p>
      </div>

      {/* ---- JAAR-DOELEN ---- */}
      <JaarDoelenSectie />

      {/* ---- AGENDA-FEED ---- */}
      <FeedTokensSectie />

      {/* ---- GEBRUIKERS ---- */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Gebruikersbeheer
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ken rollen toe aan medewerkers en beheer toegang tot de werkomgeving.
          </p>
        </div>

        <div className="bg-warning/5 border border-warning/20 rounded-md p-4 text-sm">
          <p className="text-foreground font-medium mb-1">Hoe werkt toegang?</p>
          <p className="text-muted-foreground">
            Nieuwe gebruikers kunnen zich registreren via de loginpagina, maar krijgen pas toegang als
            jij ze de rol <strong>medewerker</strong> of <strong>admin</strong> toekent. Zonder rol zien
            zij alleen een wachtscherm.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Alle gebruikers ({gebruikers.length})</h3>
          </div>

          {loading ? (
            <div className="px-5 py-12 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {gebruikers.map(g => (
                <div key={g.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {g.volledige_naam || '—'}
                        {g.id === huidigeGebruiker?.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(jij)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{g.email}</p>
                      <div className="flex gap-1.5 mt-1.5">
                        {g.rollen.length === 0 && (
                          <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">geen toegang</Badge>
                        )}
                        {g.rollen.map(r => (
                          <Badge key={r} variant="outline" className={r === 'admin' ? 'text-xs bg-accent/10 text-accent border-accent/20' : 'text-xs bg-success/10 text-success border-success/20'}>
                            {r === 'admin' && <ShieldCheck className="h-3 w-3 mr-1" />}
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!g.rollen.includes('medewerker') && (
                      <Button size="sm" variant="outline" onClick={() => rolToekennen(g.id, 'medewerker')}>
                        + Medewerker
                      </Button>
                    )}
                    {!g.rollen.includes('admin') && (
                      <Button size="sm" variant="outline" onClick={() => rolToekennen(g.id, 'admin')}>
                        + Admin
                      </Button>
                    )}
                    {g.rollen.map(r => (
                      <AlertDialog key={`del-${r}`}>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                            − {r}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Rol intrekken?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Weet je zeker dat je de rol '{r}' wilt intrekken voor {g.email}?
                              {g.rollen.length === 1 && ' Deze gebruiker verliest dan alle toegang tot de app.'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuleren</AlertDialogCancel>
                            <AlertDialogAction onClick={() => rolIntrekken(g.id, r)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Intrekken
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------
// JAAR-DOELEN sectie
// ---------------------------------------------------------------------

function JaarDoelenSectie() {
  const store = useDataStore();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<JaarDoel | null>(null);

  const openNieuw = () => {
    const huidigJaar = new Date().getFullYear();
    // Start met volgend jaar dat nog geen doel heeft, anders huidig
    const eerstVrije = [huidigJaar, huidigJaar + 1, huidigJaar + 2]
      .find(j => !store.jaarDoelen.some(d => d.jaar === j)) ?? huidigJaar;
    setEditing({
      id: '',
      jaar: eerstVrije,
      commissieDoelBedrag: undefined,
      dealwaardeDoelBedrag: undefined,
      notities: undefined,
    });
    setEditOpen(true);
  };

  const openEdit = (doel: JaarDoel) => {
    setEditing(doel);
    setEditOpen(true);
  };

  const handleDelete = async (id: string, jaar: number) => {
    if (!confirm(`Doel voor ${jaar} verwijderen?`)) return;
    try {
      await store.deleteJaarDoel(id);
      toast.success('Doel verwijderd');
    } catch (err: any) {
      toast.error(err.message ?? 'Verwijderen mislukt');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" /> Jaardoelen
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Commissie- en dealwaarde-doel per jaar. Zichtbaar als voortgangsbalk op het dashboard.
          </p>
        </div>
        <Button variant="outline" onClick={openNieuw}>
          <Plus className="h-4 w-4 mr-1" /> Doel toevoegen
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {store.jaarDoelen.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">Nog geen jaardoelen ingesteld.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {store.jaarDoelen.map(doel => (
              <div key={doel.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{doel.jaar}</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-xs text-muted-foreground mt-1">
                    <span>Commissie: <span className="font-mono-data text-foreground">{formatCurrency(doel.commissieDoelBedrag ?? 0)}</span></span>
                    <span>Dealwaarde: <span className="font-mono-data text-foreground">{formatCurrency(doel.dealwaardeDoelBedrag ?? 0)}</span></span>
                  </div>
                  {doel.notities && <p className="text-xs text-muted-foreground mt-1">{doel.notities}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(doel)} className="p-1.5 hover:bg-muted rounded transition-colors" aria-label="Bewerken">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleDelete(doel.id, doel.jaar)} className="p-1.5 hover:bg-destructive/10 rounded transition-colors" aria-label="Verwijderen">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editOpen && editing && (
        <JaarDoelDialog
          doel={editing}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}


function JaarDoelDialog({ doel, onClose }: { doel: JaarDoel; onClose: () => void }) {
  const store = useDataStore();
  const [form, setForm] = useState(doel);
  const [bezig, setBezig] = useState(false);
  const isNieuw = !doel.id;

  const num = (v: string) => v === '' ? undefined : Number(v);

  const handleSave = async () => {
    if (bezig) return;
    if (!form.jaar || form.jaar < 2020 || form.jaar > 2100) {
      toast.error('Geldig jaar tussen 2020 en 2100');
      return;
    }
    setBezig(true);
    try {
      await store.upsertJaarDoel({
        jaar: form.jaar,
        commissieDoelBedrag: form.commissieDoelBedrag,
        dealwaardeDoelBedrag: form.dealwaardeDoelBedrag,
        notities: form.notities,
      });
      toast.success(isNieuw ? 'Jaardoel aangemaakt' : 'Jaardoel bijgewerkt');
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Opslaan mislukt');
    } finally {
      setBezig(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isNieuw ? 'Nieuw jaardoel' : `Jaardoel ${doel.jaar} bewerken`}</AlertDialogTitle>
          <AlertDialogDescription>
            Stel je commissie- en dealwaarde-doel in. Voortgang verschijnt als balk op het dashboard.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Jaar</Label>
            <Input type="number" value={form.jaar}
              onChange={e => setForm(p => ({ ...p, jaar: parseInt(e.target.value) || new Date().getFullYear() }))}
              disabled={!isNieuw} />
          </div>
          <div className="space-y-1.5">
            <Label>Commissie-doel (€)</Label>
            <Input type="number" value={form.commissieDoelBedrag ?? ''}
              onChange={e => setForm(p => ({ ...p, commissieDoelBedrag: num(e.target.value) }))}
              placeholder="bv. 300000" />
          </div>
          <div className="space-y-1.5">
            <Label>Dealwaarde-doel (€)</Label>
            <Input type="number" value={form.dealwaardeDoelBedrag ?? ''}
              onChange={e => setForm(p => ({ ...p, dealwaardeDoelBedrag: num(e.target.value) }))}
              placeholder="bv. 25000000" />
          </div>
          <div className="space-y-1.5">
            <Label>Notities (optioneel)</Label>
            <Input value={form.notities ?? ''}
              onChange={e => setForm(p => ({ ...p, notities: e.target.value || undefined }))} />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={bezig}>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={bezig}>
            {bezig ? 'Bezig…' : 'Opslaan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
