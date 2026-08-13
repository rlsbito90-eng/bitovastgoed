import { useEffect, useMemo, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Download, FileText, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import BriefPDF from '@/components/offmarket/BriefPDF';
import {
  logVastgoedkansBriefPdfGenerated,
  useMarkVastgoedkansBriefVerstuurd,
  useUpsertVastgoedkansBriefConcept,
  useVastgoedkansBrieven,
  type AcquisitieBrief,
} from '@/hooks/useAcquisitieBrieven';
import {
  bepaalAanhef,
  bepaalOnderwerp,
  bouwBriefTekst,
  buildBriefViewModel,
} from '@/lib/offMarket/brief';

interface Props {
  vastgoedkansId: string;
  adres?: string | null;
  plaats?: string | null;
  eigenaarNaam?: string | null;
  enabled?: boolean;
}

function safeFilename(s: string): string {
  return (s || 'brief')
    .replace(/[^a-zA-Z0-9 \-_]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'brief';
}

export default function VastgoedkansConceptbriefKaart({
  vastgoedkansId, adres, plaats, eigenaarNaam, enabled = true,
}: Props) {
  const brieven = useVastgoedkansBrieven(vastgoedkansId);
  const upsert = useUpsertVastgoedkansBriefConcept();
  const markeer = useMarkVastgoedkansBriefVerstuurd();
  const alleBrieven = brieven.data ?? [];
  const concept = useMemo(
    () => alleBrieven.find((brief) => brief.status === 'concept') ?? null,
    [alleBrieven],
  );
  const laatsteBrief = alleBrieven[0] ?? null;
  const heeftVerstuurdeBrief = alleBrieven.some((brief) => brief.status === 'verstuurd');
  const objectadres = adres?.trim() ?? '';
  const objectomschrijving = objectadres && plaats?.trim() && !objectadres.toLowerCase().includes(plaats.trim().toLowerCase())
    ? `${objectadres} te ${plaats.trim()}`
    : objectadres;

  const [open, setOpen] = useState(false);
  const [markeerOpen, setMarkeerOpen] = useState(false);
  const [postdatum, setPostdatum] = useState(new Date().toISOString().slice(0, 10));
  const [pdfBezig, setPdfBezig] = useState(false);
  const [geadresseerde, setGeadresseerde] = useState('');
  const [bedrijfsnaam, setBedrijfsnaam] = useState('');
  const [verzendadres, setVerzendadres] = useState('');
  const [onderwerp, setOnderwerp] = useState('');
  const [brieftekst, setBrieftekst] = useState('');

  useEffect(() => {
    if (!open || !concept) return;
    const naam = concept.eigenaar_naam ?? eigenaarNaam?.trim() ?? '';
    const omschrijving = concept.objectomschrijving ?? objectomschrijving;
    const aanhef = concept.aanhef ?? bepaalAanhef(naam);
    setGeadresseerde(naam);
    setBedrijfsnaam(concept.eigenaar_bedrijfsnaam ?? '');
    setVerzendadres(concept.verzendadres ?? '');
    setOnderwerp(concept.onderwerp ?? bepaalOnderwerp(omschrijving));
    setBrieftekst(concept.brieftekst ?? bouwBriefTekst({ aanhef, objectadres: omschrijving }));
  }, [open, concept, eigenaarNaam, objectomschrijving]);

  function openNieuwConcept() {
    if (!enabled || laatsteBrief) return;
    const naam = eigenaarNaam?.trim() ?? '';
    const aanhef = bepaalAanhef(naam);
    setGeadresseerde(naam);
    setBedrijfsnaam('');
    setVerzendadres('');
    setOnderwerp(bepaalOnderwerp(objectomschrijving));
    setBrieftekst(bouwBriefTekst({ aanhef, objectadres: objectomschrijving }));
    setOpen(true);
  }

  async function opslaan() {
    if (!enabled || (!concept && laatsteBrief)) return;
    try {
      await upsert.mutateAsync({
        id: concept?.id,
        vastgoedkans_id: vastgoedkansId,
        eigenaar_naam: geadresseerde.trim() || null,
        eigenaar_bedrijfsnaam: bedrijfsnaam.trim() || null,
        verzendadres: verzendadres.trim() || null,
        objectadres: objectadres || null,
        objectomschrijving: objectomschrijving || null,
        aanhef: concept?.aanhef ?? bepaalAanhef(geadresseerde),
        onderwerp: onderwerp.trim() || null,
        brieftekst,
      });
      toast.success(concept ? 'Conceptbrief bijgewerkt.' : 'Conceptbrief opgeslagen.');
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Conceptbrief opslaan mislukt.');
    }
  }

  async function downloadPdf(brief: AcquisitieBrief) {
    if (pdfBezig) return;
    setPdfBezig(true);
    try {
      const vm = buildBriefViewModel({
        eigenaarNaam: brief.eigenaar_naam ?? '',
        eigenaarBedrijfsnaam: brief.eigenaar_bedrijfsnaam ?? '',
        verzendadres: brief.verzendadres ?? '',
        objectomschrijving: brief.objectomschrijving ?? '',
        onderwerp: brief.onderwerp ?? '',
        brieftekst: brief.brieftekst ?? '',
      });
      const blob = await pdf(<BriefPDF vm={vm} />).toBlob();
      const naam = safeFilename(vm.geadresseerdeNaam || vm.bedrijfsnaam || vm.objectomschrijving);
      const datum = (brief.verzonden_op ?? brief.created_at ?? new Date().toISOString()).split('T')[0];
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bito-brief-${naam}-${datum}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      await logVastgoedkansBriefPdfGenerated(brief);
      toast.success('PDF gegenereerd.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PDF genereren mislukt.');
    } finally {
      setPdfBezig(false);
    }
  }

  async function markeerVerstuurd() {
    if (!concept || !postdatum) return;
    try {
      await markeer.mutateAsync({
        id: concept.id,
        vastgoedkans_id: vastgoedkansId,
        postdatum,
      });
      toast.success('Brief gemarkeerd als verstuurd.');
      setMarkeerOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Markeren als verstuurd mislukt.');
    }
  }

  return (
    <section id="vastgoedkans-conceptbrief" className="section-card scroll-mt-24 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <h2 className="font-medium">Brief 1</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Bereid de brief voor, genereer lokaal de PDF en registreer pas daarna bewust de werkelijke postverzending.
          </p>
          {!enabled && !laatsteBrief && (
            <p className="mt-2 text-xs text-muted-foreground">
              Koppel eerst bewust de eigenaar aan een CRM-relatie voordat je een conceptbrief voorbereidt.
            </p>
          )}
        </div>
        {!laatsteBrief && (
          <Button onClick={openNieuwConcept} disabled={!enabled || brieven.isLoading}>
            Brief voorbereiden
          </Button>
        )}
      </div>

      {laatsteBrief && (
        <div className="mt-4 rounded-md border bg-muted/10 p-3 text-sm space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">
                {laatsteBrief.status === 'verstuurd' ? 'Brief verstuurd' : 'Concept opgeslagen'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {laatsteBrief.eigenaar_bedrijfsnaam || laatsteBrief.eigenaar_naam || 'Geadresseerde nog niet ingevuld'}
                {' · '}
                {new Date(laatsteBrief.updated_at ?? laatsteBrief.created_at).toLocaleDateString('nl-NL')}
              </p>
              {laatsteBrief.status === 'verstuurd' && laatsteBrief.postdatum && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Postdatum {new Date(`${laatsteBrief.postdatum}T00:00:00`).toLocaleDateString('nl-NL')}
                  {laatsteBrief.opvolgdatum ? ` · opvolgen op ${new Date(`${laatsteBrief.opvolgdatum}T00:00:00`).toLocaleDateString('nl-NL')}` : ''}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {concept && (
                <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Open concept</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => downloadPdf(laatsteBrief)} disabled={pdfBezig}>
                <Download className="mr-1.5 h-3.5 w-3.5" />{pdfBezig ? 'PDF maken…' : 'PDF downloaden'}
              </Button>
              {concept && (
                <Button size="sm" onClick={() => setMarkeerOpen(true)}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />Markeer verstuurd
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {heeftVerstuurdeBrief && !concept && (
        <p className="mt-3 text-xs text-muted-foreground">
          Brief 1 is afgerond. Een eventuele opvolgbrief wordt in de volgende tranche als afzonderlijke stap toegevoegd.
        </p>
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
              <Button onClick={opslaan} disabled={!enabled || upsert.isPending || !brieftekst.trim()}>
                <Save className="mr-1.5 h-4 w-4" />{upsert.isPending ? 'Opslaan…' : 'Concept opslaan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={markeerOpen} onOpenChange={setMarkeerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Markeer Brief 1 als verstuurd</DialogTitle>
            <DialogDescription>
              Bevestig dit alleen nadat de brief daadwerkelijk op de post is gedaan. Deze handeling verstuurt zelf niets.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="vastgoedkans-postdatum">Postdatum</Label>
            <Input id="vastgoedkans-postdatum" type="date" value={postdatum} onChange={(e) => setPostdatum(e.target.value)} />
            <p className="text-xs text-muted-foreground">Na bevestiging wordt de opvolgdatum automatisch berekend volgens het bestaande postprofiel.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMarkeerOpen(false)}>Annuleren</Button>
            <Button onClick={markeerVerstuurd} disabled={markeer.isPending || !postdatum}>
              <Send className="mr-1.5 h-4 w-4" />{markeer.isPending ? 'Registreren…' : 'Bevestig verzending'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
