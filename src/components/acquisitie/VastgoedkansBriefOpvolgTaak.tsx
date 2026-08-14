import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useVastgoedkansEigenaarActiviteit } from '@/hooks/useVastgoedkansEigenaarActiviteit';
import type { AcquisitieBrief } from '@/hooks/useAcquisitieBrieven';
import type { BriefEigenaarOptie } from '@/components/acquisitie/VastgoedkansConceptbriefKaart';

interface Props {
  vastgoedkansId: string;
  brief: AcquisitieBrief;
  eigenaren: BriefEigenaarOptie[];
  objectId?: string | null;
  contextLabel?: string;
}

function norm(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl-NL')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatteerPostcode(value: string | null | undefined) {
  const compact = (value ?? '').replace(/\s+/g, '').toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(compact) ? `${compact.slice(0, 4)} ${compact.slice(4)}` : (value ?? '').trim();
}

function eigenaarAdres(eigenaar: BriefEigenaarOptie) {
  return [
    eigenaar.adres?.trim(),
    [formatteerPostcode(eigenaar.postcode), eigenaar.plaats?.trim()].filter(Boolean).join(' '),
  ].filter(Boolean).join('\n');
}

function eigenaarNaam(eigenaar: BriefEigenaarOptie) {
  return eigenaar.bedrijfsnaam || eigenaar.naam;
}

export function vindBriefEigenaar(brief: AcquisitieBrief, eigenaren: BriefEigenaarOptie[]): BriefEigenaarOptie | null {
  const doelNaam = norm(brief.eigenaar_bedrijfsnaam || brief.eigenaar_naam);
  const doelAdres = norm(brief.verzendadres);
  if (!doelNaam) return null;

  const naamMatches = eigenaren.filter((eigenaar) => norm(eigenaarNaam(eigenaar)) === doelNaam);
  if (doelAdres) {
    const exact = naamMatches.filter((eigenaar) => norm(eigenaarAdres(eigenaar)) === doelAdres);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;
  }
  return naamMatches.length === 1 ? naamMatches[0] : null;
}

export default function VastgoedkansBriefOpvolgTaak({ vastgoedkansId, brief, eigenaren, objectId, contextLabel }: Props) {
  const automatisch = useMemo(() => vindBriefEigenaar(brief, eigenaren), [brief, eigenaren]);
  const [eigenaarId, setEigenaarId] = useState('');
  const [open, setOpen] = useState(false);
  const eigenaar = eigenaren.find((item) => item.id === (eigenaarId || automatisch?.id)) ?? null;
  const activiteit = useVastgoedkansEigenaarActiviteit(vastgoedkansId, eigenaar?.id ?? null);
  const [titel, setTitel] = useState('');
  const [deadline, setDeadline] = useState(brief.opvolgdatum ?? '');
  const [notities, setNotities] = useState('');

  useEffect(() => {
    if (automatisch) setEigenaarId(automatisch.id);
  }, [automatisch?.id]);

  function openTaak() {
    if (!eigenaar) return;
    setTitel(`Opvolgen: ${eigenaarNaam(eigenaar)}`);
    setDeadline(brief.opvolgdatum ?? new Date().toISOString().slice(0, 10));
    setNotities(contextLabel ? `Vastgoedkans: ${contextLabel}\nAanleiding: Brief 1 verstuurd.` : 'Aanleiding: Brief 1 verstuurd.');
    setOpen(true);
  }

  async function opslaan() {
    if (!eigenaar || !titel.trim() || !deadline) return;
    try {
      await activiteit.voegTaak.mutateAsync({
        vastgoedkansId,
        eigenaarId: eigenaar.id,
        relatieId: eigenaar.crmRelatieId,
        objectId,
        titel: titel.trim(),
        type: 'Follow-up',
        deadline,
        prioriteit: 'normaal',
        notities: notities.trim() || null,
      });
      toast.success('Vervolgtaak aan eigenaar en Vastgoedkans gekoppeld.');
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Vervolgtaak opslaan mislukt.');
    }
  }

  return (
    <div id="vastgoedkans-opvolging" className="mt-4 rounded-md border border-dashed p-3 sm:p-4">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Vervolgtaak</p>
            <p className="mt-1 text-xs text-muted-foreground">De taak wordt aan de geadresseerde eigenaar én deze Vastgoedkans gekoppeld. Een CRM-relatie is optioneel en wordt alleen meegenomen als die eigenaar bewust is gekoppeld.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={openTaak} disabled={!eigenaar}>
            <CalendarPlus className="mr-1.5 h-4 w-4" />Vervolgtaak aanmaken
          </Button>
        </div>

        {!automatisch && eigenaren.length > 0 && (
          <div>
            <Label>Eigenaar voor opvolging</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={eigenaarId} onChange={(e) => setEigenaarId(e.target.value)}>
              <option value="">Kies bewust de geadresseerde eigenaar…</option>
              {eigenaren.map((item) => <option key={item.id} value={item.id}>{eigenaarNaam(item)}</option>)}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">De opgeslagen brief kon niet uniek aan één eigenaar worden gekoppeld; daarom wordt niets automatisch gekozen.</p>
          </div>
        )}
        {automatisch && <p className="text-xs text-muted-foreground">Geadresseerde herkend: <span className="font-medium text-foreground">{eigenaarNaam(automatisch)}</span>.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vervolgtaak aanmaken</DialogTitle>
            <DialogDescription>Dit maakt uitsluitend een interne taak aan; er wordt niets verzonden en geen commerciële status gewijzigd.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Eigenaar</Label><Input value={eigenaar ? eigenaarNaam(eigenaar) : ''} disabled /></div>
            <div><Label>Titel</Label><Input value={titel} onChange={(e) => setTitel(e.target.value)} /></div>
            <div><Label>Deadline</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
            <div><Label>Notities</Label><Textarea rows={4} value={notities} onChange={(e) => setNotities(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
              <Button onClick={opslaan} disabled={activiteit.voegTaak.isPending || !titel.trim() || !deadline}>{activiteit.voegTaak.isPending ? 'Opslaan…' : 'Taak opslaan'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
