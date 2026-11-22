// src/components/forms/QuickCreateRelationDialog.tsx
//
// Fase 4A.1 — Compacte herbruikbare dialog voor het snel aanmaken van een
// relatie vanuit andere flows (objecten, kandidaten, biedingen, taken,
// contactmomenten, deals). V1: standalone, nog niet geïntegreerd.
//
// Beslissingen (zie .lovable/plan.md / 4A):
//   - Geen tabs, één scherm.
//   - Geen "Meer"-velden in V1.
//   - Duplicate-hint strict op exact e-mailadres of cijfers van telefoon.
//   - "Onbekend"/"-"/"–"/"naamloos" tellen als leeg en worden nooit opgeslagen.
//   - Minimaal één van naam, bedrijfsnaam, e-mail of telefoon vereist.

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useModalScrollContainment } from '@/hooks/useModalScrollContainment';
import { AlertCircle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useDataStore } from '@/hooks/useDataStore';
import { getRelatieDropdownLabel } from '@/lib/relatieNaam';
import { vindMogelijkeRelaties,isGeldigeLinkedinProfielUrl } from '@/lib/relaties/relatieInvoerDubbelen';
import type { PartijType, Partijprofiel, Relatie } from '@/data/mock-data';
import {
  PARTIJPROFIELEN, STANDAARD_NIEUWE_RELATIE, legacyTypeVoorNieuweRelatie,
  partijprofielVanExplicietLegacyType,
} from '@/lib/relaties/partijprofiel';

// =====================================================================
// Types & constants
// =====================================================================

export type QuickCreateContext =
  | 'verkoper'
  | 'kandidaat'
  | 'bieder'
  | 'contact'
  | 'taak'
  | 'deal'
  | 'algemeen';

export interface QuickCreateDefaults {
  naam?: string;
  bedrijfsnaam?: string;
  email?: string;
  telefoon?: string;
  linkedinUrl?: string;
  /** Technische legacy voorinvulling vanuit oudere workflows. */
  type?: PartijType;
  /** Eén en dezelfde zichtbare indeling als bij uitgebreid toevoegen. */
  partijprofiel?: Partijprofiel;
  rechtsvorm?: 'bv' | 'nv' | 'cv';
}

export interface QuickCreateRelationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: QuickCreateContext;
  defaultValues?: QuickCreateDefaults;
  onCreated: (relatie: Relatie) => void;
  /** Blijf na toevoegen in het formulier voor het volgende contact. */
  showSaveNext?: boolean;
  onSavedNext?: (relatie: Relatie) => void;
  onCancel?: () => void;
}

/** Alleen een expliciete prefill mag van de standaard 'Belegger' afwijken. */
function quickStartProfiel(defaults?:QuickCreateDefaults):Partijprofiel{
  return defaults?.partijprofiel
    ?? (defaults?.type?partijprofielVanExplicietLegacyType(defaults.type):STANDAARD_NIEUWE_RELATIE.partijprofiel);
}
function quickStartRechtsvorm(defaults?:QuickCreateDefaults):'bv'|'nv'|'cv'{
  return defaults?.rechtsvorm??STANDAARD_NIEUWE_RELATIE.rechtsvorm;
}

const PLACEHOLDERS = new Set(['onbekend', 'onbekende relatie', 'naamloos', '-', '–']);

// =====================================================================
// Helpers
// =====================================================================

const cleanField = (v: string | undefined): string => {
  const s = (v ?? '').trim();
  if (!s) return '';
  if (PLACEHOLDERS.has(s.toLowerCase())) return '';
  return s;
};

const onlyDigits = (v: string): string => v.replace(/\D+/g, '');

// =====================================================================
// Component
// =====================================================================

export function QuickCreateRelationDialog({
  open,
  onOpenChange,
  defaultValues,
  onCreated,
  showSaveNext=false,
  onSavedNext,
  onCancel,
}: QuickCreateRelationDialogProps) {
  const { addRelatie, addContactpersoon, relaties, contactpersonen } = useDataStore();

  const defaultProfiel = quickStartProfiel(defaultValues);
  const defaultRechtsvorm = quickStartRechtsvorm(defaultValues);

  const [naam, setNaam] = useState(defaultValues?.naam ?? '');
  const [bedrijfsnaam, setBedrijfsnaam] = useState(defaultValues?.bedrijfsnaam ?? '');
  const [email, setEmail] = useState(defaultValues?.email ?? '');
  const [telefoon, setTelefoon] = useState(defaultValues?.telefoon ?? '');
  const [linkedinUrl,setLinkedinUrl] = useState(defaultValues?.linkedinUrl ?? '');
  const [aantalToegevoegd,setAantalToegevoegd] = useState(0);
  const naamRef = useRef<HTMLInputElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  useModalScrollContainment(bodyScrollRef, open);
  const [partijprofiel, setPartijprofiel] = useState<Partijprofiel>(defaultProfiel);
  const [rechtsvorm, setRechtsvorm] = useState<'bv'|'nv'|'cv'>(defaultRechtsvorm);
  const [error, setError] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  // Reset bij her-openen
  useEffect(() => {
    if (open) {
      setNaam(defaultValues?.naam ?? '');
      setBedrijfsnaam(defaultValues?.bedrijfsnaam ?? '');
      setEmail(defaultValues?.email ?? '');
      setTelefoon(defaultValues?.telefoon ?? '');
      setLinkedinUrl(defaultValues?.linkedinUrl ?? '');
      setAantalToegevoegd(0);
      setPartijprofiel(quickStartProfiel(defaultValues));
      setRechtsvorm(quickStartRechtsvorm(defaultValues));
      setError(null);
      setBezig(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Eenduidige matches blokkeren dubbele aanmaak. Vergelijk ook primaire en
  // secundaire contactpersonen, niet uitsluitend de legacy Relaties-velden.
  const duplicates = useMemo(() => vindMogelijkeRelaties({
    bedrijfsnaam, contactpersoon:naam, email,telefoon,linkedinUrl,
  },relaties,contactpersonen ?? []).slice(0,5),[
    bedrijfsnaam,naam,email,telefoon,linkedinUrl,relaties,contactpersonen,
  ]);

  const handleKiesBestaand = (r: Relatie) => {
    onCreated(r);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleSave = async (volgende=false) => {
    const naamC = cleanField(naam);
    const bedrijfC = cleanField(bedrijfsnaam);
    const emailC = cleanField(email);
    const telC = cleanField(telefoon);
    const linkedinC = cleanField(linkedinUrl);

    if (!naamC && !bedrijfC && !emailC && !telC) {
      setError('Vul minimaal een naam, bedrijfsnaam, e-mail of telefoonnummer in.');
      return;
    }

    if(!isGeldigeLinkedinProfielUrl(linkedinC)){
      setError('Vul een geldige LinkedIn-profiel-URL in, of laat het veld leeg.');
      return;
    }
    if(duplicates.length>0){
      setError('Deze contactgegevens komen mogelijk al voor in Relaties. Open de bestaande relatie in plaats van een tweede aan te maken.');
      return;
    }
    setError(null);
    setBezig(true);
    try {
      const nieuw = await addRelatie({
        bedrijfsnaam: bedrijfC,
        contactpersoon: naamC, // legacy veld, blijft voor backwards compat
        type:legacyTypeVoorNieuweRelatie(partijprofiel),
        partijprofiel,
        investeerderSubtype:rechtsvorm,
        telefoon: telC,
        email: emailC,
        linkedinUrl:linkedinC || undefined,
        bronRelatie:'Handmatig toegevoegd',
        regio: [],
        assetClasses: [],
        ndaGetekend: false,
        leadStatus: 'actief',
        laatsteContact: '',
      });

      if (!nieuw) {
        throw new Error('Relatie niet aangemaakt.');
      }

      // Maak primaire contactpersoon aan indien naam is ingevuld
      if (naamC) {
        try {
          await addContactpersoon({
            relatieId: nieuw.id,
            naam: naamC,
            email: emailC || undefined,
            telefoon: telC || undefined,
            linkedinUrl: linkedinC || undefined,
            isPrimair: true,
            decisionMaker: false,
            voorkeurTaal: 'nl',
          });
        } catch (e) {
          // Contactpersoon-fail mag relatie-create niet ongedaan maken
          console.warn('Kon contactpersoon niet aanmaken:', e);
        }
      }

      toast.success('Relatie aangemaakt.');
      if(volgende){
        onSavedNext?.(nieuw);
        setNaam('');setBedrijfsnaam('');setEmail('');setTelefoon('');setLinkedinUrl('');
        setPartijprofiel(quickStartProfiel(defaultValues));
        setRechtsvorm(quickStartRechtsvorm(defaultValues));
        setAantalToegevoegd(n=>n+1);
        naamRef.current?.focus();
      }else{
        onCreated(nieuw);
        onOpenChange(false);
      }
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Onbekende fout';
      toast.error(`Relatie aanmaken mislukt: ${msg}`);
      setError('Aanmaken mislukt. Probeer opnieuw.');
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleCancel() : onOpenChange(o))}>
      <DialogContent className="flex h-[min(88svh,740px)] max-h-[88dvh] w-[calc(100vw-1rem)] min-w-0 max-w-md flex-col gap-0 overflow-hidden overscroll-none p-0 sm:w-[95vw]">
        <DialogHeader className="shrink-0 touch-none border-b border-border/70 px-4 pb-3 pt-5 sm:px-5">
          <DialogTitle>Nieuwe relatie</DialogTitle>
          <DialogDescription>
            Snel toevoegen. Je kunt later meer details aanvullen via de relatiepagina.
          </DialogDescription>
        </DialogHeader>

        <div ref={bodyScrollRef} data-testid="quick-relatie-scroll"
          className="min-h-0 min-w-0 w-full max-w-full flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-none touch-pan-y px-4 py-4 sm:px-5">
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="qcr-naam">Naam / contactpersoon</Label>
            <Input
              id="qcr-naam"
              ref={naamRef}
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              placeholder="Bijv. Jan de Vries"
              disabled={bezig}
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="qcr-bedrijf">Bedrijfsnaam</Label>
            <Input
              id="qcr-bedrijf"
              value={bedrijfsnaam}
              onChange={(e) => setBedrijfsnaam(e.target.value)}
              placeholder="Bijv. Voorbeeld Invest BV"
              disabled={bezig}
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="qcr-email">E-mail</Label>
              <Input
                id="qcr-email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@voorbeeld.nl"
                disabled={bezig}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qcr-tel">Telefoon</Label>
              <Input
                id="qcr-tel"
                type="tel"
                inputMode="tel"
                value={telefoon}
                onChange={(e) => setTelefoon(e.target.value)}
                placeholder="06 12345678"
                disabled={bezig}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="qcr-linkedin">LinkedIn-profiel (optioneel)</Label>
            <Input
              id="qcr-linkedin"
              type="url"
              value={linkedinUrl}
              onChange={e=>setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/..."
              autoCapitalize="none"
              autoCorrect="off"
              disabled={bezig}
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="qcr-profiel">Partijprofiel</Label>
              <Select value={partijprofiel}
                onValueChange={value=>setPartijprofiel(value as Partijprofiel)}
                disabled={bezig}>
                <SelectTrigger id="qcr-profiel" aria-label="Partijprofiel">
                  <SelectValue/>
                </SelectTrigger>
                <SelectContent>
                  {PARTIJPROFIELEN.map(p=>
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qcr-rechtsvorm">Rechtsvorm</Label>
              <select id="qcr-rechtsvorm" aria-label="Rechtsvorm"
                disabled={bezig} value={rechtsvorm}
                onChange={e=>setRechtsvorm(e.target.value as 'bv'|'nv'|'cv')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="bv">BV</option>
                <option value="nv">NV</option>
                <option value="cv">CV</option>
              </select>
            </div>
          </div>

          {duplicates.length > 0 && (
            <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription>
                <div className="font-medium mb-1">Mogelijk bestaat deze relatie al.</div>
                <ul className="space-y-1">
                  {duplicates.map(({relatie:r,redenen}) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 text-sm truncate">{getRelatieDropdownLabel(r)} <span className="text-xs text-muted-foreground">({redenen.join(', ')})</span></span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleKiesBestaand(r)}
                        disabled={bezig}
                      >
                        Kies deze
                      </Button>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        {aantalToegevoegd>0 && <p className="shrink-0 border-t border-border/50 px-4 py-1.5 text-xs text-muted-foreground sm:px-5">
          {aantalToegevoegd} relatie(s) toegevoegd in deze invoersessie.
        </p>}
        <DialogFooter className="z-10 grid min-w-0 shrink-0 grid-cols-2 gap-2 border-t border-border bg-background px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:flex sm:flex-row sm:flex-wrap sm:justify-end sm:px-5">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={bezig} className="min-w-0">
            {showSaveNext ? 'Sluiten' : 'Annuleren'}
          </Button>
          {showSaveNext&&<Button type="button" variant="outline" className="col-span-2 min-w-0 sm:order-2 sm:col-auto"
            onClick={()=>void handleSave(true)} disabled={bezig||duplicates.length>0}>
            Opslaan en volgende
          </Button>}
          <Button type="button" className="min-w-0 sm:order-3" onClick={()=>void handleSave(false)} disabled={bezig||duplicates.length>0}>
            {bezig ? 'Bezig…' : 'Relatie aanmaken'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuickCreateRelationDialog;
