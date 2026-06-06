// Handmatige eigenaarsonderzoek-sectie. Geen autosave: bekijken-modus +
// expliciete Bewerken/Opslaan/Annuleren met dirty-guard.
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { UserSearch, Pencil, FileSearch, UserCheck, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { OffMarketEigenaarstatusBadge } from '@/components/offmarket/OffMarketBadges';
import { useUpdateOffMarketSignaal } from '@/hooks/useOffMarketSignalen';
import { useFormDirtyGuard } from '@/hooks/useFormDirtyGuard';
import {
  EIGENAARSTATUS_LABEL, EIGENAARSTATUS_VOLGORDE,
  EIGENAARTYPE_LABEL, EIGENAARBRON_LABEL,
  type OffMarketSignaal, type OffMarketEigenaarstatus,
  type OffMarketEigenaartype, type OffMarketEigenaarbron,
} from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
}

interface EigenaarForm {
  eigenaarstatus: OffMarketEigenaarstatus;
  eigenaar_naam: string;
  eigenaar_type: OffMarketEigenaartype | '';
  eigenaar_bedrijfsnaam: string;
  eigenaar_kvk: string;
  eigenaar_telefoon: string;
  eigenaar_email: string;
  eigenaar_website: string;
  eigenaar_linkedin: string;
  kadastrale_aanduiding: string;
  eigenaarbron: OffMarketEigenaarbron | '';
  eigenaar_onderzoek_notities: string;
}

function snapshot(s: OffMarketSignaal): EigenaarForm {
  const a = s as any;
  return {
    eigenaarstatus: (a.eigenaarstatus ?? 'onbekend') as OffMarketEigenaarstatus,
    eigenaar_naam: a.eigenaar_naam ?? '',
    eigenaar_type: (a.eigenaar_type ?? '') as OffMarketEigenaartype | '',
    eigenaar_bedrijfsnaam: a.eigenaar_bedrijfsnaam ?? '',
    eigenaar_kvk: a.eigenaar_kvk ?? '',
    eigenaar_telefoon: a.eigenaar_telefoon ?? '',
    eigenaar_email: a.eigenaar_email ?? '',
    eigenaar_website: a.eigenaar_website ?? '',
    eigenaar_linkedin: a.eigenaar_linkedin ?? '',
    kadastrale_aanduiding: a.kadastrale_aanduiding ?? '',
    eigenaarbron: (a.eigenaarbron ?? '') as OffMarketEigenaarbron | '',
    eigenaar_onderzoek_notities: a.eigenaar_onderzoek_notities ?? '',
  };
}

function formatDateTimeNL(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('nl-NL', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function SignaalEigenaarsonderzoekSectie({ signaal }: Props) {
  const update = useUpdateOffMarketSignaal();
  const [editMode, setEditMode] = useState(false);
  const initial = useMemo(() => snapshot(signaal), [signaal]);
  const [form, setForm] = useState<EigenaarForm>(initial);

  // Sync wanneer signaal verandert en we niet aan het bewerken zijn.
  useEffect(() => {
    if (!editMode) setForm(snapshot(signaal));
  }, [signaal, editMode]);

  const { guardedOnOpenChange } = useFormDirtyGuard(editMode, form, (v) => setEditMode(v));

  const setF = <K extends keyof EigenaarForm>(k: K, v: EigenaarForm[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const huidig = snapshot(signaal);
  const eigenaarstatusNu = huidig.eigenaarstatus;
  const kadasterCheckOp = (signaal as any).kadaster_check_op as string | null | undefined;

  const handleOpslaan = async () => {
    try {
      const patch: any = {
        eigenaarstatus: form.eigenaarstatus,
        eigenaar_naam: form.eigenaar_naam.trim() || null,
        eigenaar_type: form.eigenaar_type || null,
        eigenaar_bedrijfsnaam: form.eigenaar_bedrijfsnaam.trim() || null,
        eigenaar_kvk: form.eigenaar_kvk.trim() || null,
        eigenaar_telefoon: form.eigenaar_telefoon.trim() || null,
        eigenaar_email: form.eigenaar_email.trim() || null,
        eigenaar_website: form.eigenaar_website.trim() || null,
        eigenaar_linkedin: form.eigenaar_linkedin.trim() || null,
        kadastrale_aanduiding: form.kadastrale_aanduiding.trim() || null,
        eigenaarbron: form.eigenaarbron || null,
        eigenaar_onderzoek_notities: form.eigenaar_onderzoek_notities.trim() || null,
      };
      await update.mutateAsync({ id: signaal.id, patch });
      toast.success('Eigenaargegevens opgeslagen');
      setEditMode(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Opslaan mislukt');
    }
  };

  const handleAnnuleren = () => {
    guardedOnOpenChange(false);
    setForm(snapshot(signaal));
  };

  const setKadasterCheck = async () => {
    try {
      await update.mutateAsync({
        id: signaal.id,
        patch: { kadaster_check_op: new Date().toISOString() } as any,
      });
      toast.success('Kadaster check geregistreerd');
    } catch (e: any) {
      toast.error(e?.message ?? 'Bijwerken mislukt');
    }
  };

  const setEigenaarGevonden = async () => {
    try {
      await update.mutateAsync({
        id: signaal.id,
        patch: {
          eigenaarstatus: 'gevonden',
          eigenaar_bekend: true,
          status: 'eigenaar_gevonden',
        } as any,
      });
      toast.success('Eigenaar gemarkeerd als gevonden');
    } catch (e: any) {
      toast.error(e?.message ?? 'Bijwerken mislukt');
    }
  };

  const setEigenaarBenaderen = async () => {
    try {
      await update.mutateAsync({
        id: signaal.id,
        patch: { eigenaarstatus: 'benaderd', status: 'benaderd' } as any,
      });
      toast.success('Eigenaar gemarkeerd als benaderd');
    } catch (e: any) {
      toast.error(e?.message ?? 'Bijwerken mislukt');
    }
  };

  return (
    <section data-testid="eigenaarsonderzoek-sectie" className="section-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserSearch className="h-4 w-4 text-muted-foreground" />
          Eigenaarsonderzoek
          <OffMarketEigenaarstatusBadge status={eigenaarstatusNu} />
        </h2>
        {!editMode && (
          <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
            <Pencil className="h-4 w-4" /> Bewerken
          </Button>
        )}
      </div>

      {/* Snelle acties */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          type="button"
          disabled={update.isPending}
          onClick={setKadasterCheck}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border bg-card text-foreground border-border hover:border-accent/50 hover:text-accent disabled:opacity-50"
        >
          <FileSearch className="h-3.5 w-3.5" />
          Kadaster check uitgevoerd
        </button>
        <button
          type="button"
          aria-pressed={eigenaarstatusNu === 'gevonden'}
          disabled={update.isPending || eigenaarstatusNu === 'gevonden'}
          onClick={setEigenaarGevonden}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
            eigenaarstatusNu === 'gevonden'
              ? 'bg-accent text-accent-foreground border-accent cursor-default'
              : 'bg-card text-foreground border-border hover:border-accent/50 hover:text-accent disabled:opacity-50'
          }`}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Eigenaar gevonden
        </button>
        <button
          type="button"
          aria-pressed={eigenaarstatusNu === 'benaderd'}
          disabled={update.isPending || eigenaarstatusNu === 'benaderd'}
          onClick={setEigenaarBenaderen}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
            eigenaarstatusNu === 'benaderd'
              ? 'bg-accent text-accent-foreground border-accent cursor-default'
              : 'bg-card text-foreground border-border hover:border-accent/50 hover:text-accent disabled:opacity-50'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          Eigenaar benaderen
        </button>
      </div>

      {!editMode ? (
        <ReadView signaal={signaal} kadasterCheckOp={kadasterCheckOp ?? null} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Eigenaarstatus">
            <Select value={form.eigenaarstatus} onValueChange={(v) => setF('eigenaarstatus', v as OffMarketEigenaarstatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EIGENAARSTATUS_VOLGORDE.map(s => (
                  <SelectItem key={s} value={s}>{EIGENAARSTATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Eigenaar naam">
            <Input value={form.eigenaar_naam} onChange={e => setF('eigenaar_naam', e.target.value)} />
          </Field>
          <Field label="Eigenaar type">
            <Select value={form.eigenaar_type || 'geen'} onValueChange={(v) => setF('eigenaar_type', v === 'geen' ? '' : (v as OffMarketEigenaartype))}>
              <SelectTrigger><SelectValue placeholder="Niet ingesteld" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="geen">Niet ingesteld</SelectItem>
                {(Object.keys(EIGENAARTYPE_LABEL) as OffMarketEigenaartype[]).map(t => (
                  <SelectItem key={t} value={t}>{EIGENAARTYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Bedrijfsnaam">
            <Input value={form.eigenaar_bedrijfsnaam} onChange={e => setF('eigenaar_bedrijfsnaam', e.target.value)} />
          </Field>
          <Field label="KvK-nummer">
            <Input value={form.eigenaar_kvk} onChange={e => setF('eigenaar_kvk', e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Telefoon">
            <Input value={form.eigenaar_telefoon} onChange={e => setF('eigenaar_telefoon', e.target.value)} type="tel" />
          </Field>
          <Field label="E-mail">
            <Input value={form.eigenaar_email} onChange={e => setF('eigenaar_email', e.target.value)} type="email" />
          </Field>
          <Field label="Website">
            <Input value={form.eigenaar_website} onChange={e => setF('eigenaar_website', e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="LinkedIn">
            <Input value={form.eigenaar_linkedin} onChange={e => setF('eigenaar_linkedin', e.target.value)} placeholder="https://linkedin.com/…" />
          </Field>
          <Field label="Kadastrale aanduiding">
            <Input value={form.kadastrale_aanduiding} onChange={e => setF('kadastrale_aanduiding', e.target.value)} />
          </Field>
          <Field label="Eigenaarbron">
            <Select value={form.eigenaarbron || 'geen'} onValueChange={(v) => setF('eigenaarbron', v === 'geen' ? '' : (v as OffMarketEigenaarbron))}>
              <SelectTrigger><SelectValue placeholder="Niet ingesteld" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="geen">Niet ingesteld</SelectItem>
                {(Object.keys(EIGENAARBRON_LABEL) as OffMarketEigenaarbron[]).map(b => (
                  <SelectItem key={b} value={b}>{EIGENAARBRON_LABEL[b]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Onderzoeknotities">
              <Textarea
                rows={4}
                value={form.eigenaar_onderzoek_notities}
                onChange={e => setF('eigenaar_onderzoek_notities', e.target.value)}
              />
            </Field>
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleAnnuleren} disabled={update.isPending}>
              Annuleren
            </Button>
            <Button size="sm" onClick={handleOpslaan} disabled={update.isPending}>
              {update.isPending ? 'Opslaan…' : 'Opslaan'}
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Laatste Kadaster check: <span className="font-mono-data">{formatDateTimeNL(kadasterCheckOp)}</span>
      </p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ReadRow({ label, value, mono, link }: { label: string; value: string | null | undefined; mono?: boolean; link?: 'url' | 'email' | 'tel' }) {
  const isEmpty = !value;
  const text = isEmpty ? '—' : value!;
  let body: React.ReactNode = text;
  if (!isEmpty && link === 'url') {
    const href = text.startsWith('http') ? text : `https://${text}`;
    body = <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">{text}</a>;
  } else if (!isEmpty && link === 'email') {
    body = <a href={`mailto:${text}`} className="text-accent hover:underline break-all">{text}</a>;
  } else if (!isEmpty && link === 'tel') {
    body = <a href={`tel:${text}`} className="text-accent hover:underline">{text}</a>;
  }
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm text-foreground ${mono ? 'font-mono-data' : ''}`}>{body}</p>
    </div>
  );
}

function ReadView({ signaal, kadasterCheckOp }: { signaal: OffMarketSignaal; kadasterCheckOp: string | null }) {
  const a = signaal as any;
  const type = a.eigenaar_type as OffMarketEigenaartype | null;
  const bron = a.eigenaarbron as OffMarketEigenaarbron | null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
      <ReadRow label="Eigenaar naam" value={a.eigenaar_naam} />
      <ReadRow label="Eigenaar type" value={type ? EIGENAARTYPE_LABEL[type] : null} />
      <ReadRow label="Bedrijfsnaam" value={a.eigenaar_bedrijfsnaam} />
      <ReadRow label="KvK-nummer" value={a.eigenaar_kvk} mono />
      <ReadRow label="Telefoon" value={a.eigenaar_telefoon} link="tel" mono />
      <ReadRow label="E-mail" value={a.eigenaar_email} link="email" />
      <ReadRow label="Website" value={a.eigenaar_website} link="url" />
      <ReadRow label="LinkedIn" value={a.eigenaar_linkedin} link="url" />
      <ReadRow label="Kadastrale aanduiding" value={a.kadastrale_aanduiding} mono />
      <ReadRow label="Eigenaarbron" value={bron ? EIGENAARBRON_LABEL[bron] : null} />
      <div className="md:col-span-2">
        <ReadRow label="Onderzoeknotities" value={a.eigenaar_onderzoek_notities} />
      </div>
      {/* kadaster_check_op wordt ook onderaan getoond — hier alleen voor rust */}
      <input type="hidden" data-kadaster-check-op={kadasterCheckOp ?? ''} />
    </div>
  );
}
