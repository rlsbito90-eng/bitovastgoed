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

type BriefStap = 'brief_1' | 'brief_2';

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

function briefVoorStap(brieven: AcquisitieBrief[], stap: BriefStap): AcquisitieBrief | null {
  if (stap === 'brief_2') return brieven.find((brief) => brief.campagne_stap === 'brief_2') ?? null;
  return brieven.find((brief) => brief.campagne_stap !== 'brief_2') ?? null;
}

function bouwOpvolgbriefTekst(aanhef: string, objectomschrijving: string): string {
  const objectregel = objectomschrijving
    ? `over het pand ${objectomschrijving}`
    : 'over uw vastgoed';
  return `${aanhef}\n\nOnlangs heb ik u een brief gestuurd ${objectregel}. Ik wilde kort navragen of u gelegenheid heeft gehad om deze te bekijken.\n\nMocht verkoop nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact. Ook als het op dit moment niet speelt, hoor ik dat uiteraard graag.\n\nMet vriendelijke groet,\n\nRamysh Bito\nBito Vastgoed`;
}

export default function VastgoedkansConceptbriefKaart({
  vastgoedkansId, adres, plaats, eigenaarNaam, enabled = true,
}: Props) {
  const brieven = useVastgoedkansBrieven(vastgoedkansId);
  const upsert = useUpsertVastgoedkansBriefConcept();
  const markeer = useMarkVastgoedkansBriefVerstuurd();
  const alleBrieven = brieven.data ?? [];
  const brief1 = useMemo(() => briefVoorStap(alleBrieven, 'brief_1'), [alleBrieven]);
  const brief2 = useMemo(() => briefVoorStap(alleBrieven, 'brief_2'), [alleBrieven]);
  const objectadres = adres?.trim() ?? '';
  const objectomschrijving = objectadres && plaats?.trim() && !objectadres.toLowerCase().includes(plaats.trim().toLowerCase())
    ? `${objectadres} te ${plaats.trim()}`
    : objectadres;

  const [open, setOpen] = useState(false);
  const [actieveStap, setActieveStap] = useState<BriefStap>('brief_1');
  const [markeerTarget, setMarkeerTarget] = useState<AcquisitieBrief | null>(null);
  const [postdatum, setPostdatum] = useState(new Date().toISOString().slice(0, 10));
  const [pdfBezig, setPdfBezig] = useState<string | null>(null);
  const [geadresseerde, setGeadresseerde] = useState('');
  const [bedrijfsnaam, setBedrijfsnaam] = useState('');
  const [verzendadres, setVerzendadres] = useState('');
  const [onderwerp, setOnderwerp] = useState('');
  const [brieftekst, setBrieftekst] = useState('');

  const actieveBrief = actieveStap === 'brief_1' ? brief1 : brief2;
  const actiefConcept = actieveBrief?.status === 'concept' ? actieveBrief : null;

  useEffect(() => {
    if (!open || !actiefConcept) return;
    const naam = actiefConcept.eigenaar_naam ?? eigenaarNaam?.trim() ?? '';
    const omschrijving = actiefConcept.objectomschrijving ?? objectomschrijving;
    const aanhef = actiefConcept.aanhef ?? bepaalAanhef(naam);
    setGeadresseerde(naam);
    setBedrijfsnaam(actiefConcept.eigenaar_bedrijfsnaam ?? '');
    setVerzendadres(actiefConcept.verzendadres ?? '');
    setOnderwerp(actiefConcept.onderwerp ?? bepaalOnderwerp(omschrijving));
    setBrieftekst(
      actiefConcept.brieftekst
      ?? (actieveStap === 'brief_2'
        ? bouwOpvolgbriefTekst(aanhef, omschrijving)
        : bouwBriefTekst({ aanhef, objectadres: omschrijving })),
    );
  }, [open, actiefConcept, actieveStap, eigenaarNaam, objectomschrijving]);

  function openNieuweBrief(stap: BriefStap) {
    if (!enabled) return;
    if (stap === 'brief_1' && brief1) return;
    if (stap === 'brief_2' && (!brief1 || brief1.status !== 'verstuurd' || brief2)) return;

    const bron = stap === 'brief_2' ? brief1 : null;
    const naam = bron?.eigenaar_naam ?? eigenaarNaam?.trim() ?? '';
    const aanhef = bepaalAanhef(naam);
    setActieveStap(stap);
    setGeadresseerde(naam);
    setBedrijfsnaam(bron?.eigenaar_bedrijfsnaam ?? '');
    setVerzendadres(bron?.verzendadres ?? '');
    setOnderwerp(stap === 'brief_2' ? `Opvolging: ${bepaalOnderwerp(objectomschrijving)}` : bepaalOnderwerp(objectomschrijving));
    setBrieftekst(
      stap === 'brief_2'
        ? bouwOpvolgbriefTekst(aanhef, objectomschrijving)
        : bouwBriefTekst({ aanhef, objectadres: objectomschrijving }),
    );
    setOpen(true);
  }

  function openConcept(stap: BriefStap) {
    const brief = stap === 'brief_1' ? brief1 : brief2;
    if (brief?.status !== 'concept') return;
    setActieveStap(stap);
    setOpen(true);
  }

  async function opslaan() {
    if (!enabled || (actieveBrief && !actiefConcept)) return;
    try {
      await upsert.mutateAsync({
        id: actiefConcept?.id,
        vastgoedkans_id: vastgoedkansId,
        campagne_stap: actieveStap,
        eigenaar_naam: geadresseerde.trim() || null,
        eigenaar_bedrijfsnaam: bedrijfsnaam.trim() || null,
        verzendadres: verzendadres.trim() || null,
        objectadres: objectadres || null,
        objectomschrijving: objectomschrijving || null,
        aanhef: actiefConcept?.aanhef ?? bepaalAanhef(geadresseerde),
        onderwerp: onderwerp.trim() || null,
        brieftekst,
      });
      toast.success(`${actieveStap === 'brief_2' ? 'Brief 2' : 'Brief 1'} als concept opgeslagen.`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Conceptbrief opslaan mislukt.');
    }
  }

  async function downloadPdf(brief: AcquisitieBrief) {
    if (pdfBezig) return;
    setPdfBezig(brief.id);
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
      const stap = brief.campagne_stap === 'brief_2' ? 'brief-2' : 'brief-1';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bito-${stap}-${naam}-${datum}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      await logVastgoedkansBriefPdfGenerated(brief);
      toast.success('PDF gegenereerd.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PDF genereren mislukt.');
    } finally {
      setPdfBezig(null);
    }
  }

  function openMarkeer(brief: AcquisitieBrief) {
    if (brief.status !== 'concept') return;
    setPostdatum(new Date().toISOString().slice(0, 10));
    setMarkeerTarget(brief);
  }

  async function markeerVerstuurd() {
    if (!markeerTarget || !postdatum) return;
    try {
      await markeer.mutateAsync({
        id: markeerTarget.id,
        vastgoedkans_id: vastgoedkansId,
        postdatum,
      });
      toast.success(`${markeerTarget.campagne_stap === 'brief_2' ? 'Brief 2' : 'Brief 1'} gemarkeerd als verstuurd.`);
      setMarkeerTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Markeren als verstuurd mislukt.');
    }
  }

  const renderBrief = (stap: BriefStap, brief: AcquisitieBrief | null) => {
    const nummer = stap === 'brief_2' ? 2 : 1;
    const kanNieuw = stap === 'brief_1'
      ? !brief
      : brief1?.status === 'verstuurd' && !brief;

    return (
      <div className="rounded-md border p-3 sm:p-4" data-testid={`vastgoedkans-${stap}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-medium">Brief {nummer}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {stap === 'brief_1'
                ? 'Eerste benadering van de eigenaar.'
                : 'Expliciete opvolgbrief na de geregistreerde verzending van Brief 1.'}
            </p>
          </div>
          {kanNieuw && (
            <Button size="sm" onClick={() => openNieuweBrief(stap)} disabled={!enabled || brieven.isLoading}>
              {stap === 'brief_2' ? 'Brief 2 voorbereiden' : 'Brief voorbereiden'}
            </Button>
          )}
        </div>

        {brief ? (
          <div className="mt-3 rounded-md bg-muted/20 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{brief.status === 'verstuurd' ? 'Verstuurd' : 'Concept opgeslagen'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {brief.eigenaar_bedrijfsnaam || brief.eigenaar_naam || 'Geadresseerde nog niet ingevuld'}
                  {' · '}
                  {new Date(brief.updated_at ?? brief.created_at).toLocaleDateString('nl-NL')}
                </p>
                {brief.status === 'verstuurd' && brief.postdatum && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Postdatum {new Date(`${brief.postdatum}T00:00:00`).toLocaleDateString('nl-NL')}
                    {brief.opvolgdatum ? ` · opvolgen op ${new Date(`${brief.opvolgdatum}T00:00:00`).toLocaleDateString('nl-NL')}` : ''}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {brief.status === 'concept' && (
                  <Button size="sm" variant="outline" onClick={() => openConcept(stap)}>Open concept</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => downloadPdf(brief)} disabled={Boolean(pdfBezig)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />{pdfBezig === brief.id ? 'PDF maken…' : 'PDF downloaden'}
                </Button>
                {brief.status === 'concept' && (
                  <Button size="sm" onClick={() => openMarkeer(brief)}>
                    <Send className="mr-1.5 h-3.5 w-3.5" />Markeer verstuurd
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : stap === 'brief_2' && brief1?.status !== 'verstuurd' ? (
          <p className="mt-3 text-xs text-muted-foreground">Brief 2 komt beschikbaar nadat de werkelijke verzending van Brief 1 is geregistreerd.</p>
        ) : null}
      </div>
    );
  };

  return (
    <section id="vastgoedkans-conceptbrief" className="section-card scroll-mt-24 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4" />
        <h2 className="font-medium">Brieven</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Elke brief blijft een afzonderlijke campagne-stap. PDF-generatie is lokaal; verzending wordt alleen handmatig geregistreerd.
      </p>
      {!enabled && !brief1 && (
        <p className="mt-2 text-xs text-muted-foreground">Koppel eerst bewust de eigenaar aan een CRM-relatie voordat je een brief voorbereidt.</p>
      )}

      <div className="mt-4 space-y-3">
        {renderBrief('brief_1', brief1)}
        {renderBrief('brief_2', brief2)}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{actiefConcept ? `Brief ${actieveStap === 'brief_2' ? 2 : 1} bewerken` : `Brief ${actieveStap === 'brief_2' ? 2 : 1} voorbereiden`}</DialogTitle>
            <DialogDescription>Dit slaat uitsluitend een concept op. Er wordt niets verzonden en de Vastgoedkans-status verandert niet automatisch.</DialogDescription>
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

      <Dialog open={Boolean(markeerTarget)} onOpenChange={(v) => !v && setMarkeerTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Markeer Brief {markeerTarget?.campagne_stap === 'brief_2' ? 2 : 1} als verstuurd</DialogTitle>
            <DialogDescription>Bevestig dit alleen nadat de brief daadwerkelijk op de post is gedaan. Deze handeling verstuurt zelf niets.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="vastgoedkans-postdatum">Postdatum</Label>
            <Input id="vastgoedkans-postdatum" type="date" value={postdatum} onChange={(e) => setPostdatum(e.target.value)} />
            <p className="text-xs text-muted-foreground">Na bevestiging wordt de opvolgdatum automatisch berekend volgens het bestaande postprofiel.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMarkeerTarget(null)}>Annuleren</Button>
            <Button onClick={markeerVerstuurd} disabled={markeer.isPending || !postdatum}>
              <Send className="mr-1.5 h-4 w-4" />{markeer.isPending ? 'Registreren…' : 'Bevestig verzending'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
