import { useEffect, useMemo, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Download, FileText, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import BriefPDF from '@/components/offmarket/BriefPDF';
import VastgoedkansBriefOpvolgTaak from '@/components/acquisitie/VastgoedkansBriefOpvolgTaak';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import {
  logVastgoedkansBriefPdfGenerated,
  useMarkVastgoedkansBriefVerstuurd,
  useVastgoedkansBrieven,
  type AcquisitieBrief,
} from '@/hooks/useAcquisitieBrieven';
import { useUpsertPandenverkennerBriefConcept, type PandenverkennerAdresseerwijze } from '@/hooks/usePandenverkennerBrieven';
import { bepaalAanhef, bepaalOnderwerp, buildBriefViewModel } from '@/lib/offMarket/brief';
import {
  bepaalPandenverkennerCopyProfiel,
  bouwPandenverkennerBrief1,
  kiesPandenverkennerVariant,
} from '@/lib/acquisitie/pandenverkennerCopy';

type BriefStap = 'brief_1' | 'brief_2';
type BriefMetPandenverkennerMeta = AcquisitieBrief & {
  geadresseerde_label?: string | null;
  adresseerwijze?: PandenverkennerAdresseerwijze | null;
};

export interface BriefEigenaarOptie {
  id: string;
  partijType: 'natuurlijk_persoon' | 'rechtspersoon' | 'onbekend';
  naam: string;
  bedrijfsnaam: string | null;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  crmRelatieId: string | null;
}

interface Props {
  vastgoedkansId: string;
  adres?: string | null;
  plaats?: string | null;
  eigenaarNaam?: string | null;
  eigenaren?: BriefEigenaarOptie[];
  enabled?: boolean;
}

const ALGEMENE_EIGENAAR_LABEL = 'Aan de eigenaar van';

function safeFilename(s: string): string {
  return (s || 'brief').replace(/[^a-zA-Z0-9 \-_]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'brief';
}

function briefVoorStap(brieven: AcquisitieBrief[], stap: BriefStap): AcquisitieBrief | null {
  if (stap === 'brief_2') return brieven.find((brief) => brief.campagne_stap === 'brief_2') ?? null;
  return brieven.find((brief) => brief.campagne_stap !== 'brief_2') ?? null;
}

function formatteerPostcode(value: string | null | undefined): string {
  const compact = (value ?? '').replace(/\s+/g, '').toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(compact) ? `${compact.slice(0, 4)} ${compact.slice(4)}` : (value ?? '').trim();
}

function formatteerPlaats(value: string | null | undefined): string {
  const plaats = (value ?? '').trim();
  if (!plaats) return '';
  return plaats.toLocaleLowerCase('nl-NL').replace(/(^|[\s-])\p{L}/gu, (m) => m.toLocaleUpperCase('nl-NL'));
}

function pandAdresVoorBrief(adres: string | null | undefined, isBagPand: boolean, heeftVbo: boolean): string {
  const schoon = (adres ?? '').trim();
  if (!schoon || !isBagPand || heeftVbo) return schoon;
  return schoon.replace(/-(?:H|[1-4])$/i, '').trim();
}

function eigenaarVelden(eigenaar: BriefEigenaarOptie | null) {
  if (!eigenaar) return { geadresseerde: '', bedrijfsnaam: '', verzendadres: '' };
  const isBedrijf = eigenaar.partijType === 'rechtspersoon';
  const bedrijfsnaam = eigenaar.bedrijfsnaam ?? (isBedrijf ? eigenaar.naam : '');
  const geadresseerde = isBedrijf ? '' : eigenaar.naam;
  const plaatsregel = [formatteerPostcode(eigenaar.postcode), formatteerPlaats(eigenaar.plaats)].filter(Boolean).join(' ');
  const verzendadres = [eigenaar.adres?.trim(), plaatsregel].filter(Boolean).join('\n');
  return { geadresseerde, bedrijfsnaam, verzendadres };
}

function bouwOpvolgbriefTekst(aanhef: string, objectomschrijving: string): string {
  const objectregel = objectomschrijving ? `over het pand ${objectomschrijving}` : 'over het betreffende pand';
  return `${aanhef}\n\nOnlangs heb ik u een brief gestuurd ${objectregel}. Ik wilde kort navragen of u gelegenheid heeft gehad om deze te bekijken.\n\nMocht verkoop nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact. Ook als het op dit moment niet speelt, hoor ik dat uiteraard graag.\n\nMet vriendelijke groet,\n\nRamysh Bito\nBito Vastgoed`;
}

export default function VastgoedkansConceptbriefKaart({
  vastgoedkansId, adres, plaats, eigenaarNaam, eigenaren = [], enabled = true,
}: Props) {
  const brieven = useVastgoedkansBrieven(vastgoedkansId);
  const upsert = useUpsertPandenverkennerBriefConcept();
  const markeer = useMarkVastgoedkansBriefVerstuurd();
  const { getKansById } = useVastgoedkansen();
  const kans = getKansById(vastgoedkansId);
  const alleBrieven = brieven.data ?? [];
  const brief1 = useMemo(() => briefVoorStap(alleBrieven, 'brief_1'), [alleBrieven]);
  const brief2 = useMemo(() => briefVoorStap(alleBrieven, 'brief_2'), [alleBrieven]);
  const objectadres = pandAdresVoorBrief(kans?.adres ?? adres, Boolean(kans?.bagPandId), Boolean(kans?.bagVerblijfsobjectId));
  const nettePlaats = formatteerPlaats(kans?.plaats ?? plaats);
  const objectomschrijving = objectadres && nettePlaats && !objectadres.toLowerCase().includes(nettePlaats.toLowerCase())
    ? `${objectadres} te ${nettePlaats}`
    : objectadres;
  const objectVerzendadres = [
    objectadres,
    [formatteerPostcode(kans?.postcode), nettePlaats].filter(Boolean).join(' '),
  ].filter(Boolean).join('\n');
  const kanAlgemeenNaarEigenaar = Boolean(objectadres && formatteerPostcode(kans?.postcode) && nettePlaats);
  const kanVoorbereiden = enabled || kanAlgemeenNaarEigenaar;
  const profiel = bepaalPandenverkennerCopyProfiel(kans?.typeVastgoed);

  const [open, setOpen] = useState(false);
  const [actieveStap, setActieveStap] = useState<BriefStap>('brief_1');
  const [markeerTarget, setMarkeerTarget] = useState<AcquisitieBrief | null>(null);
  const [postdatum, setPostdatum] = useState(new Date().toISOString().slice(0, 10));
  const [pdfBezig, setPdfBezig] = useState<string | null>(null);
  const [geselecteerdeEigenaarId, setGeselecteerdeEigenaarId] = useState('');
  const [geadresseerde, setGeadresseerde] = useState('');
  const [bedrijfsnaam, setBedrijfsnaam] = useState('');
  const [geadresseerdeLabel, setGeadresseerdeLabel] = useState<string | null>(null);
  const [adresseerwijze, setAdresseerwijze] = useState<PandenverkennerAdresseerwijze>('eigenaar_objectadres');
  const [verzendadres, setVerzendadres] = useState('');
  const [onderwerp, setOnderwerp] = useState('');
  const [brieftekst, setBrieftekst] = useState('');
  const [copyVariantCode, setCopyVariantCode] = useState<string | null>(null);

  const actieveBrief = actieveStap === 'brief_1' ? brief1 : brief2;
  const actiefConcept = actieveBrief?.status === 'concept' ? actieveBrief as BriefMetPandenverkennerMeta : null;
  const kansContext = [kans?.kansnummer, objectomschrijving].filter(Boolean).join(' · ');

  function maakBrief1Tekst(eigenaarBevestigd: boolean, key?: string | null) {
    const copy = kiesPandenverkennerVariant({
      vastgoedkansId,
      typeVastgoed: kans?.typeVastgoed,
      objectomschrijving,
      plaats: kans?.plaats ?? plaats,
      geadresseerdeKey: key,
      eigenaarBevestigd,
    });
    const inhoud = bouwPandenverkennerBrief1({
      vastgoedkansId,
      typeVastgoed: kans?.typeVastgoed,
      objectomschrijving,
      plaats: kans?.plaats ?? plaats,
      geadresseerdeKey: key,
      eigenaarBevestigd,
    }, copy);
    setCopyVariantCode(copy.variantCode);
    setOnderwerp(inhoud.onderwerp);
    setBrieftekst(inhoud.brieftekst);
  }

  function zetAlgemeneEigenaar(stap: BriefStap) {
    setGeselecteerdeEigenaarId('');
    setGeadresseerde('');
    setBedrijfsnaam('');
    setGeadresseerdeLabel(ALGEMENE_EIGENAAR_LABEL);
    setAdresseerwijze('eigenaar_objectadres');
    setVerzendadres(objectVerzendadres);
    if (stap === 'brief_1') maakBrief1Tekst(false, `eigenaar-objectadres|${objectVerzendadres}`);
    else {
      setCopyVariantCode(null);
      setOnderwerp(`Opvolging: ${bepaalOnderwerp(objectomschrijving)}`);
      setBrieftekst(bouwOpvolgbriefTekst(bepaalAanhef(null), objectomschrijving));
    }
  }

  function zetBekendeEigenaar(stap: BriefStap, eigenaar: BriefEigenaarOptie) {
    const velden = eigenaarVelden(eigenaar);
    setGeselecteerdeEigenaarId(eigenaar.id);
    setGeadresseerde(velden.geadresseerde);
    setBedrijfsnaam(velden.bedrijfsnaam);
    setGeadresseerdeLabel(null);
    setAdresseerwijze('eigenaar_bekend');
    setVerzendadres(velden.verzendadres || objectVerzendadres);
    if (stap === 'brief_1') maakBrief1Tekst(true, `eigenaar|${eigenaar.id}`);
    else {
      setCopyVariantCode(null);
      setOnderwerp(`Opvolging: ${bepaalOnderwerp(objectomschrijving)}`);
      setBrieftekst(bouwOpvolgbriefTekst(bepaalAanhef(velden.geadresseerde || velden.bedrijfsnaam), objectomschrijving));
    }
  }

  useEffect(() => {
    if (!open || !actiefConcept) return;
    setGeselecteerdeEigenaarId('');
    setGeadresseerde(actiefConcept.eigenaar_naam ?? '');
    setBedrijfsnaam(actiefConcept.eigenaar_bedrijfsnaam ?? '');
    setGeadresseerdeLabel(actiefConcept.geadresseerde_label ?? null);
    setAdresseerwijze(actiefConcept.adresseerwijze ?? (actiefConcept.eigenaar_naam || actiefConcept.eigenaar_bedrijfsnaam ? 'eigenaar_bekend' : 'eigenaar_objectadres'));
    setVerzendadres(actiefConcept.verzendadres ?? '');
    setOnderwerp(actiefConcept.onderwerp ?? bepaalOnderwerp(objectomschrijving));
    setBrieftekst(actiefConcept.brieftekst ?? '');
    setCopyVariantCode(actiefConcept.copy_variant_code ?? null);
  }, [open, actiefConcept, objectomschrijving]);

  function openNieuweBrief(stap: BriefStap) {
    if (!kanVoorbereiden) return;
    if (stap === 'brief_1' && brief1) return;
    if (stap === 'brief_2' && (!brief1 || brief1.status !== 'verstuurd' || brief2)) return;
    setActieveStap(stap);

    if (stap === 'brief_2' && brief1) {
      const vorige = brief1 as BriefMetPandenverkennerMeta;
      setGeadresseerde(vorige.eigenaar_naam ?? '');
      setBedrijfsnaam(vorige.eigenaar_bedrijfsnaam ?? '');
      setGeadresseerdeLabel(vorige.geadresseerde_label ?? null);
      setAdresseerwijze(vorige.adresseerwijze ?? 'eigenaar_objectadres');
      setVerzendadres(vorige.verzendadres ?? objectVerzendadres);
      setOnderwerp(`Opvolging: ${bepaalOnderwerp(objectomschrijving)}`);
      setBrieftekst(bouwOpvolgbriefTekst(bepaalAanhef(vorige.eigenaar_naam || vorige.eigenaar_bedrijfsnaam), objectomschrijving));
      setCopyVariantCode(null);
    } else if (eigenaren.length === 1) {
      zetBekendeEigenaar(stap, eigenaren[0]);
    } else if (eigenaren.length > 1) {
      setGeselecteerdeEigenaarId('');
      setGeadresseerde('');
      setBedrijfsnaam('');
      setGeadresseerdeLabel(null);
      setAdresseerwijze('eigenaar_bekend');
      setVerzendadres('');
      setOnderwerp('');
      setBrieftekst('');
      setCopyVariantCode(null);
    } else if (eigenaarNaam?.trim()) {
      setGeselecteerdeEigenaarId('');
      setGeadresseerde(eigenaarNaam.trim());
      setBedrijfsnaam('');
      setGeadresseerdeLabel(null);
      setAdresseerwijze('eigenaar_bekend');
      setVerzendadres(objectVerzendadres);
      maakBrief1Tekst(true, `eigenaar-veld|${eigenaarNaam.trim()}`);
    } else {
      zetAlgemeneEigenaar(stap);
    }
    setOpen(true);
  }

  function kiesEigenaar(id: string) {
    const eigenaar = eigenaren.find((item) => item.id === id);
    if (eigenaar) zetBekendeEigenaar(actieveStap, eigenaar);
  }

  function openConcept(stap: BriefStap) {
    const brief = stap === 'brief_1' ? brief1 : brief2;
    if (brief?.status !== 'concept') return;
    setActieveStap(stap);
    setOpen(true);
  }

  async function opslaan() {
    if (!kanVoorbereiden || (actieveBrief && !actiefConcept)) return;
    const displayGeadresseerde = geadresseerde.trim() || bedrijfsnaam.trim() || geadresseerdeLabel?.trim() || '';
    if (!displayGeadresseerde || !verzendadres.trim()) return;
    try {
      const copy = actieveStap === 'brief_1'
        ? kiesPandenverkennerVariant({
          vastgoedkansId,
          typeVastgoed: kans?.typeVastgoed,
          objectomschrijving,
          plaats: kans?.plaats ?? plaats,
          geadresseerdeKey: adresseerwijze === 'eigenaar_objectadres' ? `eigenaar-objectadres|${verzendadres}` : `eigenaar|${geselecteerdeEigenaarId || geadresseerde || bedrijfsnaam}`,
          eigenaarBevestigd: adresseerwijze === 'eigenaar_bekend',
        })
        : null;
      await upsert.mutateAsync({
        id: actiefConcept?.id,
        vastgoedkans_id: vastgoedkansId,
        campagne_stap: actieveStap,
        eigenaar_naam: geadresseerde.trim() || null,
        eigenaar_bedrijfsnaam: bedrijfsnaam.trim() || null,
        geadresseerde_label: geadresseerdeLabel?.trim() || null,
        adresseerwijze,
        verzendadres,
        objectadres: objectadres || null,
        objectomschrijving: objectomschrijving || null,
        aanhef: bepaalAanhef(geadresseerde || bedrijfsnaam),
        onderwerp: onderwerp.trim() || null,
        brieftekst,
        copy,
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
      const meta = brief as BriefMetPandenverkennerMeta;
      const vm = buildBriefViewModel({
        eigenaarNaam: meta.geadresseerde_label || brief.eigenaar_naam || '',
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
      await markeer.mutateAsync({ id: markeerTarget.id, vastgoedkans_id: vastgoedkansId, postdatum });
      toast.success(`${markeerTarget.campagne_stap === 'brief_2' ? 'Brief 2' : 'Brief 1'} gemarkeerd als verstuurd.`);
      setMarkeerTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Markeren als verstuurd mislukt.');
    }
  }

  const renderBrief = (stap: BriefStap, brief: AcquisitieBrief | null) => {
    const nummer = stap === 'brief_2' ? 2 : 1;
    const kanNieuw = stap === 'brief_1' ? !brief : brief1?.status === 'verstuurd' && !brief;
    const meta = brief as BriefMetPandenverkennerMeta | null;
    const geadresseerdeDisplay = meta?.geadresseerde_label || brief?.eigenaar_bedrijfsnaam || brief?.eigenaar_naam || 'Geadresseerde nog niet ingevuld';
    return <div className="rounded-md border p-3 sm:p-4" data-testid={`vastgoedkans-${stap}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-medium">Brief {nummer}</h3><p className="mt-1 text-xs text-muted-foreground">{stap === 'brief_1' ? 'Eerste Pandenverkenner-benadering.' : 'Opvolgbrief na de geregistreerde verzending van Brief 1.'}</p></div>
        {kanNieuw && <Button size="sm" onClick={() => openNieuweBrief(stap)} disabled={!kanVoorbereiden || brieven.isLoading}>{stap === 'brief_2' ? 'Brief 2 voorbereiden' : 'Brief voorbereiden'}</Button>}
      </div>
      {brief ? <div className="mt-3 rounded-md bg-muted/20 p-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{brief.status === 'verstuurd' ? 'Verstuurd' : 'Concept opgeslagen'}</p><p className="mt-1 text-xs text-muted-foreground">{geadresseerdeDisplay} · {new Date(brief.updated_at ?? brief.created_at).toLocaleDateString('nl-NL')}</p>{brief.copy_profiel && <p className="mt-1 text-xs text-muted-foreground">{brief.copy_profiel} · variant {brief.copy_variant_code ?? '—'}</p>}</div><div className="flex flex-wrap gap-2">{brief.status === 'concept' && <Button size="sm" variant="outline" onClick={() => openConcept(stap)}>Open concept</Button>}<Button size="sm" variant="outline" onClick={() => downloadPdf(brief)} disabled={Boolean(pdfBezig)}><Download className="mr-1.5 h-3.5 w-3.5" />{pdfBezig === brief.id ? 'PDF maken…' : 'PDF downloaden'}</Button>{brief.status === 'concept' && <Button size="sm" onClick={() => openMarkeer(brief)}><Send className="mr-1.5 h-3.5 w-3.5" />Markeer verstuurd</Button>}</div></div>
      </div> : stap === 'brief_2' && brief1?.status !== 'verstuurd' ? <p className="mt-3 text-xs text-muted-foreground">Brief 2 komt beschikbaar nadat de werkelijke verzending van Brief 1 is geregistreerd.</p> : null}
    </div>;
  };

  const displayGeadresseerde = geadresseerde.trim() || bedrijfsnaam.trim() || geadresseerdeLabel?.trim() || '';

  return <section id="vastgoedkans-conceptbrief" className="section-card scroll-mt-24 p-4 sm:p-5">
    <div className="flex flex-wrap items-center gap-2"><FileText className="h-4 w-4" /><h2 className="font-medium">Pandenverkenner-brieven</h2><Badge variant="outline">{profiel.replace('pandenverkenner_', '').replaceAll('_', ' ')}</Badge></div>
    <p className="mt-1 text-xs text-muted-foreground">Kadaster is niet verplicht om een eerste brief te testen. Zonder bevestigde eigenaar wordt gericht geadresseerd aan “Aan de eigenaar van” op het objectadres; eigenaarvelden blijven dan bewust leeg.</p>
    {!kanVoorbereiden && !brief1 && <p className="mt-2 text-xs text-destructive">Een volledig objectadres met postcode en plaats is nodig om zonder eigenaarsonderzoek per post te benaderen.</p>}
    <div className="mt-4 space-y-3">{renderBrief('brief_1', brief1)}{renderBrief('brief_2', brief2)}</div>
    {brief1?.status === 'verstuurd' && <VastgoedkansBriefOpvolgTaak vastgoedkansId={vastgoedkansId} brief={brief1} eigenaren={eigenaren} objectId={kans?.objectId ?? null} contextLabel={kansContext} />}

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto"><DialogHeader><DialogTitle>{actiefConcept ? `Brief ${actieveStap === 'brief_2' ? 2 : 1} bewerken` : `Brief ${actieveStap === 'brief_2' ? 2 : 1} voorbereiden`}</DialogTitle><DialogDescription>Controleer tekst en adressering. Er wordt niets automatisch besteld of verzonden.</DialogDescription></DialogHeader><div className="space-y-4">
      {!actiefConcept && eigenaren.length > 1 && actieveStap === 'brief_1' && <div><Label>Geadresseerde</Label><select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={geselecteerdeEigenaarId} onChange={(e) => kiesEigenaar(e.target.value)}><option value="">Kies een bevestigde eigenaar…</option>{eigenaren.map((eigenaar) => <option key={eigenaar.id} value={eigenaar.id}>{eigenaar.bedrijfsnaam || eigenaar.naam}</option>)}</select><Button type="button" variant="link" className="mt-1 h-auto p-0 text-xs" onClick={() => zetAlgemeneEigenaar(actieveStap)}>Of adresseer algemeen aan de eigenaar van het object</Button></div>}
      {adresseerwijze === 'eigenaar_objectadres' && <div className="rounded-md border bg-muted/20 p-3 text-xs"><p className="font-medium">Algemene eigenaarspost</p><p className="mt-1 text-muted-foreground">{ALGEMENE_EIGENAAR_LABEL}<br/>{verzendadres.split('\n').map((regel, i) => <span key={`${regel}-${i}`}>{regel}{i < verzendadres.split('\n').length - 1 && <br/>}</span>)}</p></div>}
      {adresseerwijze === 'eigenaar_bekend' && <div className="grid gap-3 sm:grid-cols-2"><div><Label>Geadresseerde</Label><Input value={geadresseerde} onChange={(e) => setGeadresseerde(e.target.value)} /></div><div><Label>Bedrijfsnaam</Label><Input value={bedrijfsnaam} onChange={(e) => setBedrijfsnaam(e.target.value)} /></div></div>}
      <div><Label>Verzendadres</Label><Textarea rows={3} value={verzendadres} onChange={(e) => setVerzendadres(e.target.value)} /></div>
      {actieveStap === 'brief_1' && <p className="text-xs text-muted-foreground">A/B-toewijzing: variant <strong>{copyVariantCode ?? 'wordt bepaald'}</strong> · profiel {profiel}</p>}
      <div><Label>Onderwerp</Label><Input value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} /></div><div><Label>Brieftekst</Label><Textarea rows={18} value={brieftekst} onChange={(e) => setBrieftekst(e.target.value)} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button><Button onClick={opslaan} disabled={!kanVoorbereiden || upsert.isPending || !brieftekst.trim() || !displayGeadresseerde || !verzendadres.trim()}><Save className="mr-1.5 h-4 w-4" />{upsert.isPending ? 'Opslaan…' : 'Concept opslaan'}</Button></div>
    </div></DialogContent></Dialog>

    <Dialog open={Boolean(markeerTarget)} onOpenChange={(v) => !v && setMarkeerTarget(null)}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Markeer Brief {markeerTarget?.campagne_stap === 'brief_2' ? 2 : 1} als verstuurd</DialogTitle><DialogDescription>Bevestig dit alleen nadat de brief daadwerkelijk op de post is gedaan.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="vastgoedkans-postdatum">Postdatum</Label><Input id="vastgoedkans-postdatum" type="date" value={postdatum} onChange={(e) => setPostdatum(e.target.value)} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setMarkeerTarget(null)}>Annuleren</Button><Button onClick={markeerVerstuurd} disabled={markeer.isPending || !postdatum}><Send className="mr-1.5 h-4 w-4" />{markeer.isPending ? 'Registreren…' : 'Bevestig verzending'}</Button></div></DialogContent></Dialog>
  </section>;
}
