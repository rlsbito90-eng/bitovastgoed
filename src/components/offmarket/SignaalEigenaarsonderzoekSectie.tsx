// Handmatige eigenaarsonderzoek-sectie. Geen autosave: bekijken-modus +
// expliciete Bewerken/Opslaan/Annuleren met dirty-guard.
//
// Bevat de complete eigenaar-opvolgflow (D.2.3 t/m D.2.5):
//  - Eigenaargegevens (read/edit)
//  - Snelle status-acties (Kadaster check, gevonden, benaderen)
//  - Relatie aanmaken (prefilled vanuit eigenaargegevens)
//  - Relatie koppelen (bestaande relatie kiezen)
//  - Gekoppelde relatie tonen + ontkoppelen/wisselen
//  - Taak aanmaken vanuit templates
//  - Contactmoment loggen
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  UserSearch, Pencil, FileSearch, FileCheck2, UserCheck, Send,
  UserPlus, Link2, ListPlus, MessageSquarePlus, ArrowUpRight, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OffMarketEigenaarstatusBadge } from '@/components/offmarket/OffMarketBadges';
import { useUpdateOffMarketSignaal } from '@/hooks/useOffMarketSignalen';
import { useLinkRelatieToSignaal } from '@/hooks/useOffMarketLinks';
import { useFormDirtyGuard } from '@/hooks/useFormDirtyGuard';
import { useDataStore } from '@/hooks/useDataStore';
import { getRelatieNamen } from '@/lib/relatieNaam';
import EntityPicker, { type EntityPickerItem } from '@/components/forms/EntityPicker';
import RelatieFormDialog from '@/components/forms/RelatieFormDialog';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import ContactMomentFormDialog from '@/components/forms/ContactMomentFormDialog';
import KadasterCheckDialog from '@/components/offmarket/kadaster/KadasterCheckDialog';
import BriefVoorbereidenKnop from '@/components/offmarket/BriefVoorbereidenKnop';
import {
  signaalNaarRelatiePrefill,
  EIGENAAR_TAAK_TEMPLATES,
  deadlineOverDagen,
  bouwSignaalTaakContext,
  type EigenaarTaakTemplate,
} from '@/lib/offMarket/eigenaar';
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

const norm = (s: string | undefined | null) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

export default function SignaalEigenaarsonderzoekSectie({ signaal }: Props) {
  const update = useUpdateOffMarketSignaal();
  const linkRelatie = useLinkRelatieToSignaal();
  const { relaties, contactpersonen, getRelatieById } = useDataStore();

  const [editMode, setEditMode] = useState(false);
  const initial = useMemo(() => snapshot(signaal), [signaal]);
  const [form, setForm] = useState<EigenaarForm>(initial);

  const [nieuwRelatieOpen, setNieuwRelatieOpen] = useState(false);
  const [koppelOpen, setKoppelOpen] = useState(false);
  const [taakOpen, setTaakOpen] = useState(false);
  const [taakTemplate, setTaakTemplate] = useState<EigenaarTaakTemplate | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [kadasterOpen, setKadasterOpen] = useState(false);

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
  const eigenaarRelatieId = (signaal as any).eigenaar_relatie_id as string | null | undefined;
  const gekoppeldeRelatie = eigenaarRelatieId ? getRelatieById(eigenaarRelatieId) : null;
  const gekoppeldeRelatieNamen = gekoppeldeRelatie
    ? getRelatieNamen(gekoppeldeRelatie, contactpersonen)
    : null;

  // EntityPicker items voor "Koppel bestaande relatie"
  const relatieItems = useMemo<EntityPickerItem[]>(
    () =>
      relaties.map((r) => {
        const { primair, secundair } = getRelatieNamen(r, contactpersonen);
        const cps = contactpersonen.filter((c) => c.relatieId === r.id);
        const haystack = norm(
          [
            primair, secundair, r.bedrijfsnaam, r.contactpersoon, r.email,
            r.telefoon, r.vestigingsplaats,
            ...cps.flatMap((c) => [c.naam, c.email, c.telefoon, c.functie]),
          ].filter(Boolean).join(' '),
        );
        return { id: r.id, primair, secundair, searchHaystack: haystack };
      }),
    [relaties, contactpersonen],
  );

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
        patch: { kadaster_check_op: new Date().toISOString(), eigenaarbron: 'kadaster' } as any,
      });
      toast.success('Handmatig gemarkeerd als gecheckt');
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

  // === Relatie aanmaken / koppelen ================================
  const handleRelatieAangemaakt = async (relatieId: string) => {
    try {
      await linkRelatie.mutateAsync({ signaalId: signaal.id, relatieId });
      await update.mutateAsync({
        id: signaal.id,
        patch: {
          eigenaar_bekend: true,
          eigenaarstatus: 'gevonden',
          status: 'eigenaar_gevonden',
        } as any,
      });
      toast.success('Relatie aangemaakt en gekoppeld');
    } catch (e: any) {
      toast.error(e?.message ?? 'Koppelen mislukt');
    }
  };

  const handleKoppelBestaand = async (relatieId: string) => {
    if (!relatieId) return;
    try {
      await linkRelatie.mutateAsync({ signaalId: signaal.id, relatieId });
      await update.mutateAsync({
        id: signaal.id,
        patch: {
          eigenaar_bekend: true,
          eigenaarstatus: 'gevonden',
          status: 'eigenaar_gevonden',
        } as any,
      });
      toast.success('Bestaande relatie gekoppeld');
    } catch (e: any) {
      toast.error(e?.message ?? 'Koppelen mislukt');
    }
  };

  const handleOntkoppel = async () => {
    try {
      await linkRelatie.mutateAsync({ signaalId: signaal.id, relatieId: null });
      toast.success('Relatie ontkoppeld');
    } catch (e: any) {
      toast.error(e?.message ?? 'Ontkoppelen mislukt');
    }
  };

  // === Taakflow ===================================================
  const openTaakMetTemplate = (tpl: EigenaarTaakTemplate) => {
    setTaakTemplate(tpl);
    setTaakOpen(true);
  };

  const prefill = useMemo(() => signaalNaarRelatiePrefill(signaal), [signaal]);

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

      {/* Gekoppelde relatie — compacte kaart, knoppen onder de naam zodat
          niets overlapt op mobiel. */}
      {gekoppeldeRelatie && gekoppeldeRelatieNamen && (
        <div className="rounded-md border border-border bg-card px-3 py-2.5 space-y-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Gekoppelde relatie</p>
            <Link
              to={`/relaties/${gekoppeldeRelatie.id}`}
              className="text-sm font-medium text-accent hover:underline inline-flex items-start gap-1 break-words"
            >
              <span className="break-words">{gekoppeldeRelatieNamen.primair}</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-70 shrink-0 mt-0.5" />
            </Link>
            {gekoppeldeRelatieNamen.secundair && (
              <p className="text-xs text-muted-foreground break-words">
                Contactpersoon: {gekoppeldeRelatieNamen.secundair}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setKoppelOpen(true)}>
              Andere relatie koppelen
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOntkoppel}
              disabled={linkRelatie.isPending}
              className="text-muted-foreground"
            >
              Ontkoppel
            </Button>
          </div>
        </div>
      )}

      {/* Externe zoekopties op bedrijfsnaam (indien beschikbaar). */}
      {(() => {
        const a = signaal as any;
        const bedrijf: string | null =
          (a.eigenaar_bedrijfsnaam && String(a.eigenaar_bedrijfsnaam).trim()) ||
          (gekoppeldeRelatie?.bedrijfsnaam && gekoppeldeRelatie.bedrijfsnaam.trim()) ||
          null;
        if (!bedrijf) return null;
        const adresDelen = [signaal.adres, signaal.plaats].filter(Boolean).join(' ');
        const q = encodeURIComponent([bedrijf, adresDelen].filter(Boolean).join(' ').trim());
        const url = `https://www.google.com/search?q=${q}`;
        return (
          <div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border bg-card hover:border-accent/50 hover:text-accent text-foreground"
            >
              <ArrowUpRight className="h-3.5 w-3.5" /> Zoek bedrijf op Google
            </a>
          </div>
        );
      })()}




      {/* Snelle acties */}
      <div className="flex gap-1.5 flex-wrap">
        <ActieKnop onClick={() => setKadasterOpen(true)} icon={<FileSearch className="h-3.5 w-3.5" />}>
          Kadaster check uitvoeren
        </ActieKnop>
        <ActieKnop onClick={setKadasterCheck} disabled={update.isPending} icon={<FileCheck2 className="h-3.5 w-3.5" />}>
          Handmatig markeren als gecheckt
        </ActieKnop>
        <ActieKnop
          onClick={setEigenaarGevonden}
          disabled={update.isPending || eigenaarstatusNu === 'gevonden'}
          actief={eigenaarstatusNu === 'gevonden'}
          icon={<UserCheck className="h-3.5 w-3.5" />}
        >
          Eigenaar gevonden
        </ActieKnop>
        <ActieKnop
          onClick={setEigenaarBenaderen}
          disabled={update.isPending || eigenaarstatusNu === 'benaderd'}
          actief={eigenaarstatusNu === 'benaderd'}
          icon={<Send className="h-3.5 w-3.5" />}
        >
          Eigenaar benaderen
        </ActieKnop>

        <div className="w-full h-0" />

        <ActieKnop onClick={() => setNieuwRelatieOpen(true)} icon={<UserPlus className="h-3.5 w-3.5" />}>
          Relatie aanmaken
        </ActieKnop>
        <ActieKnop onClick={() => setKoppelOpen(true)} icon={<Link2 className="h-3.5 w-3.5" />}>
          {gekoppeldeRelatie ? 'Andere relatie koppelen' : 'Koppel bestaande relatie'}
        </ActieKnop>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border bg-card text-foreground border-border hover:border-accent/50 hover:text-accent"
            >
              <ListPlus className="h-3.5 w-3.5" />
              Taak aanmaken
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {EIGENAAR_TAAK_TEMPLATES.map(tpl => (
              <DropdownMenuItem key={tpl.id} onClick={() => openTaakMetTemplate(tpl)}>
                {tpl.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ActieKnop onClick={() => setContactOpen(true)} icon={<MessageSquarePlus className="h-3.5 w-3.5" />}>
          Contactmoment loggen
        </ActieKnop>

        <BriefVoorbereidenKnop signaal={signaal} />
      </div>

      {/* Inline-koppelpicker (collapsed onder de knop) */}
      {koppelOpen && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <EntityPicker
            label="Bestaande relatie kiezen"
            pickerTitle="Kies relatie"
            searchPlaceholder="Zoek op bedrijf, contactpersoon, e-mail…"
            emptyLabel="Geen relatie gekozen"
            value={eigenaarRelatieId ?? ''}
            onChange={(id) => {
              if (id) {
                handleKoppelBestaand(id);
                setKoppelOpen(false);
              }
            }}
            items={relatieItems}
          />
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setKoppelOpen(false)}>Sluiten</Button>
          </div>
        </div>
      )}

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

      {/* Dialogs */}
      <RelatieFormDialog
        open={nieuwRelatieOpen}
        onOpenChange={setNieuwRelatieOpen}
        initialValues={prefill.relatie as any}
        initialPrimaireContactpersoon={prefill.contactpersoon as any}
        onCreated={(relatieId) => { handleRelatieAangemaakt(relatieId); }}
      />

      <TaakFormDialog
        open={taakOpen}
        onOpenChange={(v) => { setTaakOpen(v); if (!v) setTaakTemplate(null); }}
        defaultTitel={taakTemplate?.titel}
        defaultType={taakTemplate?.type}
        defaultPrioriteit={taakTemplate?.prioriteit}
        defaultDeadline={taakTemplate ? deadlineOverDagen(taakTemplate.dagen) : undefined}
        defaultOffMarketSignaalId={signaal.id}
        defaultRelatieId={eigenaarRelatieId ?? undefined}
        defaultNotities={bouwSignaalTaakContext(signaal, taakTemplate?.label)}
      />


      <ContactMomentFormDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        defaultOffMarketSignaalId={signaal.id}
        defaultRelatieId={eigenaarRelatieId ?? undefined}
      />

      <KadasterCheckDialog
        signaal={signaal}
        open={kadasterOpen}
        onOpenChange={setKadasterOpen}
      />
    </section>
  );
}

function ActieKnop({
  onClick, disabled, actief, icon, children,
}: {
  onClick: () => void;
  disabled?: boolean;
  actief?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={actief}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
        actief
          ? 'bg-accent text-accent-foreground border-accent cursor-default'
          : 'bg-card text-foreground border-border hover:border-accent/50 hover:text-accent disabled:opacity-50'
      }`}
    >
      {icon}
      {children}
    </button>
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
      <input type="hidden" data-kadaster-check-op={kadasterCheckOp ?? ''} />
    </div>
  );
}
