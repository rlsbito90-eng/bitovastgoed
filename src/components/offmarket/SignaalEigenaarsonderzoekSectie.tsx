// Handmatige eigenaarsonderzoek-sectie. Geen autosave: bekijken-modus +
// expliciete Bewerken/Opslaan/Annuleren met dirty-guard.
// In Acquisitie Focusmodus worden reeds opgeslagen Kadasterrechten automatisch
// verwerkt; meerdere primaire rechthebbenden binnen dezelfde rechtssituatie
// worden als normale, automatische uitkomst getoond.
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useKadasterDataRecordsForSignaal } from '@/hooks/useKadasterDataRecords';
import { useFormDirtyGuard } from '@/hooks/useFormDirtyGuard';
import { useDataStore } from '@/hooks/useDataStore';
import { getRelatieNamen } from '@/lib/relatieNaam';
import EntityPicker, { type EntityPickerItem } from '@/components/forms/EntityPicker';
import RelatieFormDialog from '@/components/forms/RelatieFormDialog';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import ContactMomentFormDialog from '@/components/forms/ContactMomentFormDialog';
import KadasterCheckDialog from '@/components/offmarket/kadaster/KadasterCheckDialog';
import BriefVoorbereidenKnop from '@/components/offmarket/BriefVoorbereidenKnop';
import { mapRechtenBlokken, blokUitOpgeslagenRecord } from '@/lib/kadaster/rechtenBlokken';
import {
  maakKadasterEigenaarVoorstel,
  pasKadasterVoorstelToe,
} from '@/lib/offMarket/acquisitie/kadasterEigenaarVoorstel';
import {
  bepaalRechtenbewusteEigenaar,
  bouwAutomatischeEigenaarPatch,
  bouwVerzendadres,
  formatteerBlootEigenaar,
  RECHTSSITUATIE_LABEL,
  RECHTSSITUATIES_MET_BLOOT_EIGENAAR,
  type PrimaireRechthebbende,
  type Rechtssituatie,
} from '@/lib/offMarket/acquisitie/rechtenbewusteEigenaar';
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
  mobileCompact?: boolean;
  focusMode?: boolean;
}

interface EigenaarForm {
  eigenaarstatus: OffMarketEigenaarstatus;
  eigenaar_naam: string;
  eigenaar_type: OffMarketEigenaartype | '';
  eigenaar_bedrijfsnaam: string;
  eigenaar_kvk: string;
  eigenaar_telefoon: string;
  eigenaar_email: string;
  /** Niet meer zichtbaar, wel behouden voor bestaande gegevens/voorstellen. */
  kadastrale_aanduiding: string;
  eigenaar_straat_huisnummer: string;
  eigenaar_postcode: string;
  eigenaar_plaats: string;
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
    kadastrale_aanduiding: a.kadastrale_aanduiding ?? '',
    eigenaar_straat_huisnummer: a.eigenaar_straat_huisnummer ?? '',
    eigenaar_postcode: a.eigenaar_postcode ?? '',
    eigenaar_plaats: a.eigenaar_plaats ?? '',
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

export default function SignaalEigenaarsonderzoekSectie({
  signaal,
  mobileCompact = false,
  focusMode = false,
}: Props) {
  const update = useUpdateOffMarketSignaal();
  const linkRelatie = useLinkRelatieToSignaal();
  const { relaties, contactpersonen, getRelatieById } = useDataStore();
  const { data: kadasterRecords = [] } = useKadasterDataRecordsForSignaal(signaal.id);

  const [editMode, setEditMode] = useState(focusMode);
  const initial = useMemo(() => snapshot(signaal), [signaal]);
  const [form, setForm] = useState<EigenaarForm>(initial);

  const [nieuwRelatieOpen, setNieuwRelatieOpen] = useState(false);
  const [koppelOpen, setKoppelOpen] = useState(false);
  const [taakOpen, setTaakOpen] = useState(false);
  const [taakTemplate, setTaakTemplate] = useState<EigenaarTaakTemplate | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [kadasterOpen, setKadasterOpen] = useState(false);

  const rechtenBron = useMemo(() => {
    const record = kadasterRecords.find((r) =>
      r.product_code === 'rechten' && (r.status === 'geleverd' || r.status === 'gedeeltelijk'),
    );
    if (!record) return { sleutel: null as string | null, blokken: [] };
    const rawRechten = (record.raw_limited as Record<string, unknown> | null | undefined)?.rechten;
    let blokken = mapRechtenBlokken(rawRechten);
    if (blokken.length === 0) {
      const fallback = blokUitOpgeslagenRecord(record);
      if (fallback) blokken = [fallback];
    }
    return { sleutel: `${record.id}:${record.fetched_at}`, blokken };
  }, [kadasterRecords]);

  const rechtenUitkomst = useMemo(
    () => bepaalRechtenbewusteEigenaar(rechtenBron.blokken),
    [rechtenBron.blokken],
  );

  const kadasterVoorstel = useMemo(
    () => (rechtenBron.blokken.length === 0
      ? maakKadasterEigenaarVoorstel([])
      : rechtenUitkomst.voorstel),
    [rechtenBron.blokken, rechtenUitkomst],
  );

  useEffect(() => {
    if (!focusMode && !editMode) setForm(snapshot(signaal));
  }, [signaal, editMode, focusMode]);

  useEffect(() => {
    if (!focusMode) return;
    setEditMode(true);
    setForm(snapshot(signaal));
  }, [focusMode, signaal.id]);

  useEffect(() => {
    if (!focusMode || rechtenUitkomst.status !== 'eenduidig' || kadasterVoorstel.status !== 'eenduidig') return;
    setForm((prev) => pasKadasterVoorstelToe(prev, kadasterVoorstel));
  }, [focusMode, kadasterVoorstel, rechtenUitkomst.status]);

  const autoVerwerktRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!focusMode) return;
    const sleutel = rechtenBron.sleutel;
    if (!sleutel) return;
    const guard = `${signaal.id}|${sleutel}`;
    if (autoVerwerktRef.current.has(guard)) return;
    const patch = bouwAutomatischeEigenaarPatch(signaal as any, rechtenUitkomst);
    if (!patch) {
      autoVerwerktRef.current.add(guard);
      return;
    }
    autoVerwerktRef.current.add(guard);
    update.mutate(
      { id: signaal.id, patch: patch as any },
      {
        onSuccess: () => {
          toast.success(
            rechtenUitkomst.controleNodig
              ? 'Eigenaar vraagt controle op basis van het Kadasterrecord'
              : rechtenUitkomst.status === 'meervoudig'
                ? `${rechtenUitkomst.primaireRechthebbenden.length} rechthebbenden automatisch verwerkt`
                : 'Eigenaargegevens automatisch overgenomen uit het Kadasterrecord',
          );
        },
        onError: () => { autoVerwerktRef.current.delete(guard); },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMode, signaal, rechtenBron.sleutel, rechtenUitkomst]);

  const { guardedOnOpenChange } = useFormDirtyGuard(editMode, form, (v) => setEditMode(v));

  const setF = <K extends keyof EigenaarForm>(k: K, v: EigenaarForm[K]) => {
    setForm((prev) => {
      const next = { ...prev, [k]: v } as EigenaarForm;
      if (
        (k === 'eigenaar_naam' || k === 'eigenaar_bedrijfsnaam')
        && (next.eigenaar_naam.trim() || next.eigenaar_bedrijfsnaam.trim())
      ) next.eigenaarstatus = 'gevonden';
      return next;
    });
  };

  const huidig = snapshot(signaal);
  const eigenaarstatusNu = focusMode ? form.eigenaarstatus : huidig.eigenaarstatus;
  const kadasterCheckOp = (signaal as any).kadaster_check_op as string | null | undefined;
  const eigenaarRelatieId = (signaal as any).eigenaar_relatie_id as string | null | undefined;
  const gekoppeldeRelatie = eigenaarRelatieId ? getRelatieById(eigenaarRelatieId) : null;
  const gekoppeldeRelatieNamen = gekoppeldeRelatie ? getRelatieNamen(gekoppeldeRelatie, contactpersonen) : null;

  const relatieItems = useMemo<EntityPickerItem[]>(
    () => relaties.map((r) => {
      const { primair, secundair } = getRelatieNamen(r, contactpersonen);
      const cps = contactpersonen.filter((c) => c.relatieId === r.id);
      const haystack = norm([
        primair, secundair, r.bedrijfsnaam, r.contactpersoon, r.email,
        r.telefoon, r.vestigingsplaats,
        ...cps.flatMap((c) => [c.naam, c.email, c.telefoon, c.functie]),
      ].filter(Boolean).join(' '));
      return { id: r.id, primair, secundair, searchHaystack: haystack };
    }),
    [relaties, contactpersonen],
  );

  const handleOpslaan = async () => {
    try {
      const verzendadres = bouwVerzendadres(
        form.eigenaar_straat_huisnummer,
        form.eigenaar_postcode,
        form.eigenaar_plaats,
      );
      const heeftEigenaar = !!(form.eigenaar_naam.trim() || form.eigenaar_bedrijfsnaam.trim());
      const compleet = heeftEigenaar && !!verzendadres;
      const patch: any = {
        eigenaarstatus: form.eigenaarstatus,
        eigenaar_naam: form.eigenaar_naam.trim() || null,
        eigenaar_type: form.eigenaar_type || null,
        eigenaar_bedrijfsnaam: form.eigenaar_bedrijfsnaam.trim() || null,
        eigenaar_kvk: form.eigenaar_kvk.trim() || null,
        eigenaar_telefoon: form.eigenaar_telefoon.trim() || null,
        eigenaar_email: form.eigenaar_email.trim() || null,
        kadastrale_aanduiding: form.kadastrale_aanduiding.trim() || null,
        eigenaar_straat_huisnummer: form.eigenaar_straat_huisnummer.trim() || null,
        eigenaar_postcode: form.eigenaar_postcode.trim() || null,
        eigenaar_plaats: form.eigenaar_plaats.trim() || null,
        eigenaar_verzendadres: verzendadres,
        eigenaarbron: form.eigenaarbron || null,
        eigenaar_onderzoek_notities: form.eigenaar_onderzoek_notities.trim() || null,
      };
      if (compleet) {
        patch.eigenaar_controle_nodig = false;
        patch.eigenaar_controle_reden = null;
      }
      await update.mutateAsync({ id: signaal.id, patch });
      toast.success('Eigenaargegevens opgeslagen');
      setEditMode(focusMode);
    } catch (e: any) {
      toast.error(e?.message ?? 'Opslaan mislukt');
    }
  };

  const handleAnnuleren = () => {
    if (focusMode) {
      setForm(snapshot(signaal));
      return;
    }
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
    } catch (e: any) { toast.error(e?.message ?? 'Bijwerken mislukt'); }
  };

  const setEigenaarGevonden = async () => {
    try {
      await update.mutateAsync({
        id: signaal.id,
        patch: { eigenaarstatus: 'gevonden', eigenaar_bekend: true, status: 'eigenaar_gevonden' } as any,
      });
      toast.success('Eigenaar gemarkeerd als gevonden');
    } catch (e: any) { toast.error(e?.message ?? 'Bijwerken mislukt'); }
  };

  const setEigenaarBenaderen = async () => {
    try {
      await update.mutateAsync({ id: signaal.id, patch: { eigenaarstatus: 'benaderd', status: 'benaderd' } as any });
      toast.success('Eigenaar gemarkeerd als benaderd');
    } catch (e: any) { toast.error(e?.message ?? 'Bijwerken mislukt'); }
  };

  const handleRelatieAangemaakt = async (relatieId: string) => {
    try {
      await linkRelatie.mutateAsync({ signaalId: signaal.id, relatieId });
      await update.mutateAsync({
        id: signaal.id,
        patch: { eigenaar_bekend: true, eigenaarstatus: 'gevonden', status: 'eigenaar_gevonden' } as any,
      });
      toast.success('Relatie aangemaakt en gekoppeld');
    } catch (e: any) { toast.error(e?.message ?? 'Koppelen mislukt'); }
  };

  const handleKoppelBestaand = async (relatieId: string) => {
    if (!relatieId) return;
    try {
      await linkRelatie.mutateAsync({ signaalId: signaal.id, relatieId });
      await update.mutateAsync({
        id: signaal.id,
        patch: { eigenaar_bekend: true, eigenaarstatus: 'gevonden', status: 'eigenaar_gevonden' } as any,
      });
      toast.success('Bestaande relatie gekoppeld');
    } catch (e: any) { toast.error(e?.message ?? 'Koppelen mislukt'); }
  };

  const handleOntkoppel = async () => {
    try {
      await linkRelatie.mutateAsync({ signaalId: signaal.id, relatieId: null });
      toast.success('Relatie ontkoppeld');
    } catch (e: any) { toast.error(e?.message ?? 'Ontkoppelen mislukt'); }
  };

  const openTaakMetTemplate = (tpl: EigenaarTaakTemplate) => {
    setTaakTemplate(tpl);
    setTaakOpen(true);
  };

  const prefill = useMemo(() => signaalNaarRelatiePrefill(signaal), [signaal]);

  return (
    <section data-testid="eigenaarsonderzoek-sectie" className="section-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserSearch className="h-4 w-4 text-muted-foreground" /> Eigenaarsonderzoek
          <OffMarketEigenaarstatusBadge status={eigenaarstatusNu} />
        </h2>
        {!editMode && (
          <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
            <Pencil className="h-4 w-4" /> Bewerken
          </Button>
        )}
      </div>

      {focusMode && (rechtenUitkomst.status === 'eenduidig' || rechtenUitkomst.status === 'meervoudig') && !rechtenUitkomst.controleNodig && (
        <div data-testid="kadaster-eigenaar-voorstel" className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-foreground">
          <span className="font-medium">Kadaster verwerkt.</span>{' '}
          {rechtenUitkomst.status === 'meervoudig'
            ? `${rechtenUitkomst.primaireRechthebbenden.length} primaire rechthebbenden zijn automatisch verwerkt.`
            : 'De primaire rechthebbende is automatisch verwerkt.'}
        </div>
      )}
      {focusMode && rechtenUitkomst.controleNodig && (
        <div data-testid="kadaster-eigenaar-controle" className="rounded-md border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs text-amber-950">
          {rechtenUitkomst.controleReden || 'Kadastergegevens vragen handmatige controle.'}
        </div>
      )}

      <RechtssituatieBlok
        signaal={signaal}
        primaireRechthebbenden={rechtenUitkomst.primaireRechthebbenden}
      />

      {gekoppeldeRelatie && gekoppeldeRelatieNamen && (
        <div className="rounded-md border border-border bg-card px-3 py-2.5 space-y-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Gekoppelde relatie</p>
            <Link to={`/relaties/${gekoppeldeRelatie.id}`} className="text-sm font-medium text-accent hover:underline inline-flex items-start gap-1 break-words">
              <span className="break-words">{gekoppeldeRelatieNamen.primair}</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-70 shrink-0 mt-0.5" />
            </Link>
            {gekoppeldeRelatieNamen.secundair && (
              <p className="text-xs text-muted-foreground break-words">Contactpersoon: {gekoppeldeRelatieNamen.secundair}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setKoppelOpen(true)}>Andere relatie koppelen</Button>
            <Button variant="outline" size="sm" onClick={handleOntkoppel} disabled={linkRelatie.isPending} className="text-muted-foreground">Ontkoppel</Button>
          </div>
        </div>
      )}

      {(() => {
        const a = signaal as any;
        const bedrijf: string | null =
          (a.eigenaar_bedrijfsnaam && String(a.eigenaar_bedrijfsnaam).trim()) ||
          (gekoppeldeRelatie?.bedrijfsnaam && gekoppeldeRelatie.bedrijfsnaam.trim()) || null;
        if (!bedrijf) return null;
        const adresDelen = [signaal.adres, signaal.plaats].filter(Boolean).join(' ');
        const q = encodeURIComponent([bedrijf, adresDelen].filter(Boolean).join(' ').trim());
        return (
          <div><a href={`https://www.google.com/search?q=${q}`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border bg-card hover:border-accent/50 hover:text-accent text-foreground">
            <ArrowUpRight className="h-3.5 w-3.5" /> Zoek bedrijf op Google
          </a></div>
        );
      })()}

      <div className="flex gap-1.5 flex-wrap">
        <ActieKnop onClick={() => setKadasterOpen(true)} icon={<FileSearch className="h-3.5 w-3.5" />}>Kadaster check uitvoeren</ActieKnop>
        <ActieKnop onClick={setKadasterCheck} disabled={update.isPending} icon={<FileCheck2 className="h-3.5 w-3.5" />}>Handmatig markeren als gecheckt</ActieKnop>
        <ActieKnop onClick={setEigenaarGevonden} disabled={update.isPending || eigenaarstatusNu === 'gevonden'} actief={eigenaarstatusNu === 'gevonden'} icon={<UserCheck className="h-3.5 w-3.5" />}>Eigenaar gevonden</ActieKnop>
        <ActieKnop onClick={setEigenaarBenaderen} disabled={update.isPending || eigenaarstatusNu === 'benaderd'} actief={eigenaarstatusNu === 'benaderd'} icon={<Send className="h-3.5 w-3.5" />}>Eigenaar benaderen</ActieKnop>
        <div className="w-full h-0" />
        <ActieKnop onClick={() => setNieuwRelatieOpen(true)} icon={<UserPlus className="h-3.5 w-3.5" />}>Relatie aanmaken</ActieKnop>
        <ActieKnop onClick={() => setKoppelOpen(true)} icon={<Link2 className="h-3.5 w-3.5" />}>{gekoppeldeRelatie ? 'Andere relatie koppelen' : 'Koppel bestaande relatie'}</ActieKnop>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border bg-card text-foreground border-border hover:border-accent/50 hover:text-accent">
              <ListPlus className="h-3.5 w-3.5" /> Taak aanmaken <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {EIGENAAR_TAAK_TEMPLATES.map(tpl => <DropdownMenuItem key={tpl.id} onClick={() => openTaakMetTemplate(tpl)}>{tpl.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
        <ActieKnop onClick={() => setContactOpen(true)} icon={<MessageSquarePlus className="h-3.5 w-3.5" />}>Contactmoment loggen</ActieKnop>
        <BriefVoorbereidenKnop signaal={signaal} />
      </div>

      {koppelOpen && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <EntityPicker label="Bestaande relatie kiezen" pickerTitle="Kies relatie" searchPlaceholder="Zoek op bedrijf, contactpersoon, e-mail…" emptyLabel="Geen relatie gekozen" value={eigenaarRelatieId ?? ''}
            onChange={(id) => { if (id) { handleKoppelBestaand(id); setKoppelOpen(false); } }} items={relatieItems} />
          <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => setKoppelOpen(false)}>Sluiten</Button></div>
        </div>
      )}

      {!editMode ? (
        <ReadView signaal={signaal} kadasterCheckOp={kadasterCheckOp ?? null} mobileCompact={mobileCompact} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Eigenaarstatus">
            <Select value={form.eigenaarstatus} onValueChange={(v) => setF('eigenaarstatus', v as OffMarketEigenaarstatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EIGENAARSTATUS_VOLGORDE.map(s => <SelectItem key={s} value={s}>{EIGENAARSTATUS_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Eigenaar naam"><Input value={form.eigenaar_naam} onChange={e => setF('eigenaar_naam', e.target.value)} /></Field>
          <Field label="Eigenaar type">
            <Select value={form.eigenaar_type || 'geen'} onValueChange={(v) => setF('eigenaar_type', v === 'geen' ? '' : (v as OffMarketEigenaartype))}>
              <SelectTrigger><SelectValue placeholder="Niet ingesteld" /></SelectTrigger>
              <SelectContent><SelectItem value="geen">Niet ingesteld</SelectItem>{(Object.keys(EIGENAARTYPE_LABEL) as OffMarketEigenaartype[]).map(t => <SelectItem key={t} value={t}>{EIGENAARTYPE_LABEL[t]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Bedrijfsnaam"><Input value={form.eigenaar_bedrijfsnaam} onChange={e => setF('eigenaar_bedrijfsnaam', e.target.value)} /></Field>
          <Field label="KvK-nummer"><Input value={form.eigenaar_kvk} onChange={e => setF('eigenaar_kvk', e.target.value)} inputMode="numeric" /></Field>
          <Field label="Telefoon"><Input value={form.eigenaar_telefoon} onChange={e => setF('eigenaar_telefoon', e.target.value)} type="tel" /></Field>
          <Field label="E-mail"><Input value={form.eigenaar_email} onChange={e => setF('eigenaar_email', e.target.value)} type="email" /></Field>
          <Field label="Straat + huisnummer"><Input value={form.eigenaar_straat_huisnummer} onChange={e => setF('eigenaar_straat_huisnummer', e.target.value)} placeholder="Keizersgracht 100" /></Field>
          <Field label="Postcode"><Input value={form.eigenaar_postcode} onChange={e => setF('eigenaar_postcode', e.target.value)} placeholder="1015 CS" /></Field>
          <Field label="Plaats"><Input value={form.eigenaar_plaats} onChange={e => setF('eigenaar_plaats', e.target.value)} placeholder="Amsterdam" /></Field>
          <Field label="Eigenaarbron">
            <Select value={form.eigenaarbron || 'geen'} onValueChange={(v) => setF('eigenaarbron', v === 'geen' ? '' : (v as OffMarketEigenaarbron))}>
              <SelectTrigger><SelectValue placeholder="Niet ingesteld" /></SelectTrigger>
              <SelectContent><SelectItem value="geen">Niet ingesteld</SelectItem>{(Object.keys(EIGENAARBRON_LABEL) as OffMarketEigenaarbron[]).map(b => <SelectItem key={b} value={b}>{EIGENAARBRON_LABEL[b]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="md:col-span-2"><Field label="Onderzoeknotities"><Textarea rows={4} value={form.eigenaar_onderzoek_notities} onChange={e => setF('eigenaar_onderzoek_notities', e.target.value)} /></Field></div>
          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleAnnuleren} disabled={update.isPending}>{focusMode ? 'Herstel opgeslagen' : 'Annuleren'}</Button>
            <Button size="sm" onClick={handleOpslaan} disabled={update.isPending}>{update.isPending ? 'Opslaan…' : 'Opslaan'}</Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">Laatste Kadaster check: <span className="font-mono-data">{formatDateTimeNL(kadasterCheckOp)}</span></p>

      {nieuwRelatieOpen && <RelatieFormDialog open onOpenChange={setNieuwRelatieOpen} initialValues={prefill.relatie as any} initialPrimaireContactpersoon={prefill.contactpersoon as any} onCreated={(relatieId) => { handleRelatieAangemaakt(relatieId); }} />}
      <TaakFormDialog open={taakOpen} onOpenChange={(v) => { setTaakOpen(v); if (!v) setTaakTemplate(null); }} defaultTitel={taakTemplate?.titel} defaultType={taakTemplate?.type} defaultPrioriteit={taakTemplate?.prioriteit} defaultDeadline={taakTemplate ? deadlineOverDagen(taakTemplate.dagen) : undefined} defaultOffMarketSignaalId={signaal.id} defaultRelatieId={eigenaarRelatieId ?? undefined} defaultNotities={bouwSignaalTaakContext(signaal, taakTemplate?.label)} />
      <ContactMomentFormDialog open={contactOpen} onOpenChange={setContactOpen} defaultOffMarketSignaalId={signaal.id} defaultRelatieId={eigenaarRelatieId ?? undefined} />
      <KadasterCheckDialog signaal={signaal} open={kadasterOpen} onOpenChange={setKadasterOpen} />
    </section>
  );
}

function RechthebbendeKaart({ rechthebbende }: { rechthebbende: PrimaireRechthebbende }) {
  const label = rechthebbende.bedrijfsnaam || rechthebbende.naam || 'Onbekende rechthebbende';
  const adres = [
    rechthebbende.straatHuisnummer,
    [rechthebbende.postcode, rechthebbende.plaats].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5 space-y-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Primaire rechthebbende</p>
          <p className="text-sm font-medium text-foreground break-words">{label}</p>
        </div>
        {rechthebbende.aandeel && (
          <span className="shrink-0 inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-mono-data text-foreground">
            Aandeel {rechthebbende.aandeel}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
        {rechthebbende.kvk && <span>KvK <span className="font-mono-data text-foreground">{rechthebbende.kvk}</span></span>}
        {adres && <span>{adres}</span>}
      </div>
    </div>
  );
}

function RechtssituatieBlok({
  signaal,
  primaireRechthebbenden,
}: {
  signaal: OffMarketSignaal;
  primaireRechthebbenden: PrimaireRechthebbende[];
}) {
  const a = signaal as any;
  const situatie = (a.eigenaar_rechtssituatie ?? null) as Rechtssituatie | null;
  const aandeel = (a.eigenaar_aandeel ?? '') as string;
  const blootLabel = formatteerBlootEigenaar(a.bloot_eigenaar ?? null);
  const controleNodig = a.eigenaar_controle_nodig === true;
  const controleReden = (a.eigenaar_controle_reden ?? '') as string;
  const meerdere = primaireRechthebbenden.length > 1;
  if (!situatie && !aandeel && !blootLabel && !controleNodig && primaireRechthebbenden.length === 0) return null;
  const toonBloot = !!blootLabel && (!situatie || RECHTSSITUATIES_MET_BLOOT_EIGENAAR.includes(situatie));
  return (
    <div data-testid="eigenaar-rechtssituatie" className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {situatie && <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-foreground">{RECHTSSITUATIE_LABEL[situatie] ?? situatie}</span>}
        {!meerdere && aandeel && <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-mono-data text-foreground">Aandeel {aandeel}</span>}
        {meerdere && <span data-testid="meerdere-rechthebbenden-badge" className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-foreground">{primaireRechthebbenden.length} rechthebbenden</span>}
        {controleNodig && <span data-testid="eigenaar-controle-badge" className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50/60 px-2 py-0.5 text-[11px] text-amber-950">Eigenaar controleren</span>}
      </div>
      {controleNodig && controleReden && <p className="text-[11px] text-muted-foreground">{controleReden}</p>}
      {meerdere && (
        <div data-testid="primaire-rechthebbenden-lijst" className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {primaireRechthebbenden.map((rechthebbende, index) => (
            <RechthebbendeKaart
              key={`${rechthebbende.bedrijfsnaam || rechthebbende.naam || 'rechthebbende'}-${rechthebbende.kvk || index}`}
              rechthebbende={rechthebbende}
            />
          ))}
        </div>
      )}
      {toonBloot && (
        <div data-testid="eigenaar-bloot-eigenaar" className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Bloot eigenaar</p>
          <p className="text-[12.5px] text-foreground">{blootLabel}</p>
          <p className="text-[11px] text-muted-foreground">Niet benaderen als acquisitiegeadresseerde.</p>
        </div>
      )}
    </div>
  );
}

function ActieKnop({ onClick, disabled, actief, icon, children }: { onClick: () => void; disabled?: boolean; actief?: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={actief} disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${actief ? 'bg-accent text-accent-foreground border-accent cursor-default' : 'bg-card text-foreground border-border hover:border-accent/50 hover:text-accent disabled:opacity-50'}`}>
      {icon}{children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function ReadRow({ label, value, mono, link }: { label: string; value: string | null | undefined; mono?: boolean; link?: 'url' | 'email' | 'tel' }) {
  const isEmpty = !value;
  const text = isEmpty ? '—' : value!;
  let body: React.ReactNode = text;
  if (!isEmpty && link === 'url') {
    const href = text.startsWith('http') ? text : `https://${text}`;
    body = <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">{text}</a>;
  } else if (!isEmpty && link === 'email') body = <a href={`mailto:${text}`} className="text-accent hover:underline break-all">{text}</a>;
  else if (!isEmpty && link === 'tel') body = <a href={`tel:${text}`} className="text-accent hover:underline">{text}</a>;
  return <div className="space-y-0.5"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p><p className={`text-sm text-foreground ${mono ? 'font-mono-data' : ''}`}>{body}</p></div>;
}

function ReadView({ signaal, kadasterCheckOp, mobileCompact = false }: { signaal: OffMarketSignaal; kadasterCheckOp: string | null; mobileCompact?: boolean }) {
  const a = signaal as any;
  const type = a.eigenaar_type as OffMarketEigenaartype | null;
  const bron = a.eigenaarbron as OffMarketEigenaarbron | null;
  const rijen: { label: string; value: string | null | undefined; mono?: boolean; link?: 'url' | 'email' | 'tel'; wide?: boolean }[] = [
    { label: 'Eigenaar naam', value: a.eigenaar_naam },
    { label: 'Eigenaar type', value: type ? EIGENAARTYPE_LABEL[type] : null },
    { label: 'Bedrijfsnaam', value: a.eigenaar_bedrijfsnaam },
    { label: 'KvK-nummer', value: a.eigenaar_kvk, mono: true },
    { label: 'Telefoon', value: a.eigenaar_telefoon, link: 'tel', mono: true },
    { label: 'E-mail', value: a.eigenaar_email, link: 'email' },
    { label: 'Straat + huisnummer', value: a.eigenaar_straat_huisnummer },
    { label: 'Postcode', value: a.eigenaar_postcode, mono: true },
    { label: 'Plaats', value: a.eigenaar_plaats },
    { label: 'Eigenaarbron', value: bron ? EIGENAARBRON_LABEL[bron] : null },
    { label: 'Onderzoeknotities', value: a.eigenaar_onderzoek_notities, wide: true },
  ];
  const zichtbaar = mobileCompact ? rijen.filter((r) => !!(r.value && String(r.value).trim())) : rijen;
  if (mobileCompact && zichtbaar.length === 0) {
    return <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-3 text-[12.5px] text-muted-foreground">Nog geen eigenaargegevens vastgelegd.<input type="hidden" data-kadaster-check-op={kadasterCheckOp ?? ''} /></div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
      {zichtbaar.map((r) => <div key={r.label} className={r.wide ? 'md:col-span-2' : ''}><ReadRow label={r.label} value={r.value} mono={r.mono} link={r.link} /></div>)}
      <input type="hidden" data-kadaster-check-op={kadasterCheckOp ?? ''} />
    </div>
  );
}
