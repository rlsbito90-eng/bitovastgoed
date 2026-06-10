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

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
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
import type { PartijType, Relatie } from '@/data/mock-data';

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
  type?: PartijType;
}

export interface QuickCreateRelationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: QuickCreateContext;
  defaultValues?: QuickCreateDefaults;
  onCreated: (relatie: Relatie) => void;
  onCancel?: () => void;
}

const PARTIJ_LABELS: Record<PartijType, string> = {
  belegger: 'Belegger',
  ontwikkelaar: 'Ontwikkelaar',
  eigenaar: 'Eigenaar',
  makelaar: 'Makelaar',
  partner: 'Partner',
  overig: 'Overig',
};

const PARTIJ_ORDER: PartijType[] = [
  'belegger',
  'eigenaar',
  'ontwikkelaar',
  'makelaar',
  'partner',
  'overig',
];

const CONTEXT_DEFAULT_TYPE: Record<QuickCreateContext, PartijType> = {
  verkoper: 'eigenaar',
  kandidaat: 'belegger',
  bieder: 'belegger',
  deal: 'belegger',
  contact: 'overig',
  taak: 'overig',
  algemeen: 'overig',
};

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
  context = 'algemeen',
  defaultValues,
  onCreated,
  onCancel,
}: QuickCreateRelationDialogProps) {
  const { addRelatie, addContactpersoon, relaties } = useDataStore();

  const defaultType = defaultValues?.type ?? CONTEXT_DEFAULT_TYPE[context];

  const [naam, setNaam] = useState(defaultValues?.naam ?? '');
  const [bedrijfsnaam, setBedrijfsnaam] = useState(defaultValues?.bedrijfsnaam ?? '');
  const [email, setEmail] = useState(defaultValues?.email ?? '');
  const [telefoon, setTelefoon] = useState(defaultValues?.telefoon ?? '');
  const [type, setType] = useState<PartijType>(defaultType);
  const [error, setError] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  // Reset bij her-openen
  useEffect(() => {
    if (open) {
      setNaam(defaultValues?.naam ?? '');
      setBedrijfsnaam(defaultValues?.bedrijfsnaam ?? '');
      setEmail(defaultValues?.email ?? '');
      setTelefoon(defaultValues?.telefoon ?? '');
      setType(defaultValues?.type ?? CONTEXT_DEFAULT_TYPE[context]);
      setError(null);
      setBezig(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Duplicate hint — strict op e-mail (case-insensitive) en telefoon (cijfers)
  const duplicates = useMemo<Relatie[]>(() => {
    const e = cleanField(email).toLowerCase();
    const t = onlyDigits(cleanField(telefoon));
    if (!e && !t) return [];
    const hits: Relatie[] = [];
    for (const r of relaties) {
      const matchEmail = !!e && (r.email ?? '').trim().toLowerCase() === e;
      const matchTel = !!t && onlyDigits(r.telefoon ?? '') === t;
      if (matchEmail || matchTel) hits.push(r);
      if (hits.length >= 3) break;
    }
    return hits;
  }, [email, telefoon, relaties]);

  const handleKiesBestaand = (r: Relatie) => {
    onCreated(r);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleSave = async () => {
    const naamC = cleanField(naam);
    const bedrijfC = cleanField(bedrijfsnaam);
    const emailC = cleanField(email);
    const telC = cleanField(telefoon);

    if (!naamC && !bedrijfC && !emailC && !telC) {
      setError('Vul minimaal een naam, bedrijfsnaam, e-mail of telefoonnummer in.');
      return;
    }

    setError(null);
    setBezig(true);
    try {
      const nieuw = await addRelatie({
        bedrijfsnaam: bedrijfC,
        contactpersoon: naamC, // legacy veld, blijft voor backwards compat
        type,
        telefoon: telC,
        email: emailC,
        regio: [],
        assetClasses: [],
        ndaGetekend: false,
        leadStatus: 'lauw',
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
      onCreated(nieuw);
      onOpenChange(false);
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
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle>Nieuwe relatie</DialogTitle>
          <DialogDescription>
            Snel toevoegen. Je kunt later meer details aanvullen via de relatiepagina.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="qcr-naam">Naam / contactpersoon</Label>
            <Input
              id="qcr-naam"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <Label htmlFor="qcr-type">Partijtype</Label>
            <Select value={type} onValueChange={(v) => setType(v as PartijType)} disabled={bezig}>
              <SelectTrigger id="qcr-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTIJ_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PARTIJ_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {duplicates.length > 0 && (
            <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription>
                <div className="font-medium mb-1">Mogelijk bestaat deze relatie al.</div>
                <ul className="space-y-1">
                  {duplicates.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate">{getRelatieDropdownLabel(r)}</span>
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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={bezig}>
            Annuleren
          </Button>
          <Button type="button" onClick={handleSave} disabled={bezig}>
            {bezig ? 'Bezig…' : 'Relatie aanmaken'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuickCreateRelationDialog;
