import { useEffect, useMemo, useState } from 'react';
import { FileText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpsertVastgoedkansBriefConcept, useVastgoedkansBrieven } from '@/hooks/useAcquisitieBrieven';
import { bepaalAanhef, bepaalOnderwerp, bouwBriefTekst } from '@/lib/offMarket/brief';

interface Props {
  vastgoedkansId: string;
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  eigenaarNaam?: string | null;
}

export default function VastgoedkansConceptbriefKaart({
  vastgoedkansId, adres, postcode, plaats, eigenaarNaam,
}: Props) {
  const brieven = useVastgoedkansBrieven(vastgoedkansId);
  const upsert = useUpsertVastgoedkansBriefConcept();
  const concept = useMemo(
    () => (brieven.data ?? []).find((brief) => brief.status === 'concept') ?? null,
    [brieven.data],
  );
  const objectadres = [adres?.trim(), [postcode?.trim(), plaats?.trim()].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');
  const objectomschrijving = adres?.trim()
    ? `${adres.trim()}${plaats?.trim() ? ` te ${plaats.trim()}` : ''}`
    : objectadres;

  const [open, setOpen] = useState(false);
  const [geadresseerde, setGeadresseerde] = useState('');
  const [bedrijfsnaam, setBedrijfsnaam] = useState('');
  const [verzendadres, setVerzendadres] = useState('');
  const [onderwerp, setOnderwerp] = useState('');
  const [brieftekst, setBrieftekst] = useState('');

  useEffect(() => {
    if (!open) return;
    const naam = concept?.eigenaar_naam ?? eigenaarNaam?.trim() ?? '';
    const omschrijving = concept?.objectomschrijving ?? objectomschrijving;
    const aanhef = concept?.aanhef ?? bepaalAanhef(naam);
    setGeadresseerde(naam);
    setBedrijfsnaam(concept?.eigenaar_bedrijfsnaam ?? '');
    setVerzendadres(concept?.verzendadres ?? '');
    setOnderwerp(concept?.onderwerp ?? bepaalOnderwerp(omschrijving));
    setBrieftekst(concept?.brieftekst ?? bouwBriefTekst({ aanhef, objectadres: omschrijving }));
  }, [open, concept, eigenaarNaam, objectomschrijving]);

  async function opslaan() {
    try {
      await upsert.mutateAsync({
        id: concept?.id,
        vastgoedkans_id: vastgoedkansId,
        eigenaar_naam: geadresseerde.trim() || null,
        eigenaar_bedrijfsnaam: bedrijfsnaam.trim() || null,
        verzendadres: verzendadres.trim() || null,
        objectadres: objectadres || null,
        objectomschrijving: objectomschrijving || null,
        aanhef: bepaalAanhef(geadresseerde),
        onderwerp: onderwerp.trim() || null,
        brieftekst,
      });
      toast.success(concept ? 'Conceptbrief bijgewerkt.' : 'Conceptbrief opgeslagen.');
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Conceptbrief opslaan mislukt.');
    }
  }

  return (
    <section id="vastgoedkans-conceptbrief" className="section-card scroll-mt-24 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <h2 className="font-medium">Conceptbrief</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Bereid een brief voor en sla hem op in het acquisitiedossier. Verzenden, PDF en opvolging worden in volgende stappen aangesloten.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={brieven.isLoading}>
          {concept ? 'Open concept' : 'Brief voorbereiden'}
        </Button>
      </div>

      {concept && (
        <div className="mt-4 rounded-md border bg-muted/10 p-3 text-sm">
          <p className="font-medium">Concept opgeslagen</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {concept.eigenaar_bedrijfsnaam || concept.eigenaar_naam || 'Geadresseerde nog niet ingevuld'}
            {' · '}
            {new Date(concept.updated_at ?? concept.created_at).toLocaleDateString('nl-NL')}
          </p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{concept ? 'Conceptbrief bewerken' : 'Brief voorbereiden'}</DialogTitle>
            <DialogDescription>
              Dit slaat uitsluitend een concept op. Er wordt niets verzonden en de Vastgoedkans-status verandert niet automatisch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Geadresseerde</Label><Input value={geadresseerde} onChange={(e) => setGeadresseerde(e.target.value)} /></div>
              <div><Label>Bedrijfsnaam</Label><Input value={bedrijfsnaam} onChange={(e) => setBedrijfsnaam(e.target.value)} /></div>
            </div>
            <div><Label>Verzendadres</Label><Textarea rows={3} value={verzendadres} onChange={(e) => setVerzendadres(e.target.value)} placeholder="Straat en huisnummer\nPostcode en plaats" /></div>
            <div><Label>Onderwerp</Label><Input value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} /></div>
            <div><Label>Brieftekst</Label><Textarea rows={18} value={brieftekst} onChange={(e) => setBrieftekst(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
              <Button onClick={opslaan} disabled={upsert.isPending || !brieftekst.trim()}>
                <Save className="mr-1.5 h-4 w-4" />{upsert.isPending ? 'Opslaan…' : 'Concept opslaan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
