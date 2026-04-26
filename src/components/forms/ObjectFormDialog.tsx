// src/components/forms/ObjectFormDialog.tsx
// Compleet herbouwd object-formulier, fase 2 batch 2.
//
// Indeling: 8 tabs binnen 1 dialog
//   1. Algemeen     — identificatie, locatie, classificatie, anonimiteit
//   2. Financieel   — prijs, rendementen, WOZ/taxatie
//   3. Verhuur      — status + HuurdersPanel
//   4. Pand         — oppervlakten, bouwjaar, onderhoud
//   5. Juridisch    — eigendom, erfpacht, bestemming, kadaster
//   6. Verkoper     — verkoper-info
//   7. Thesis       — samenvatting, investeringsthese, risico's
//   8. Media        — documenten + foto's (alleen na opslaan zichtbaar)
//
// Nieuwe objecten: media-tab is disabled tot het object een ID heeft
// (oftewel: eerst één keer opslaan, daarna upload).

import { useState, useEffect, ReactNode, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDataStore } from '@/hooks/useDataStore';
import type {
  ObjectVastgoed, AssetClass, VerhuurStatus, ObjectStatus,
  Energielabel, OnderhoudsstaatNiveau, VerkoperVia,
} from '@/data/mock-data';
import {
  ASSET_CLASS_LABELS,
  ONDERHOUDSSTAAT_LABELS,
  VERKOPER_VIA_LABELS,
  PROVINCIES,
  REFERENTIE_KWALITEIT_LABELS,
  berekenObjectReferentieKwaliteit,
} from '@/data/mock-data';
import { toast } from 'sonner';
import SubcategorieSelect from '@/components/object/SubcategorieSelect';
import HuurdersPanel from '@/components/object/HuurdersPanel';
import DocumentenPanel from '@/components/object/DocumentenPanel';
import FotosPanel from '@/components/object/FotosPanel';
import { Info, Image, FileText, Users, AlertCircle, CheckCircle2, BookMarked } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  object?: ObjectVastgoed | null;
}

// ---------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------

type FormState = Omit<ObjectVastgoed, 'id' | 'datumToegevoegd' | 'softDeletedAt'>;

const leegForm: FormState = {
  titel: '',
  internReferentienummer: undefined,
  anoniem: true,
  publiekeNaam: undefined,
  publiekeRegio: undefined,
  adres: undefined,
  postcode: undefined,
  plaats: '',
  provincie: '',
  type: 'wonen',
  subcategorie: undefined,
  subcategorieId: undefined,
  status: 'off-market',
  beschikbaarVanaf: undefined,
  bron: undefined,
  exclusief: false,
  vraagprijs: undefined,
  prijsindicatie: undefined,
  huurinkomsten: undefined,
  huurPerM2: undefined,
  brutoAanvangsrendement: undefined,
  nettoAanvangsrendement: undefined,
  noi: undefined,
  servicekostenJaar: undefined,
  wozWaarde: undefined,
  wozPeildatum: undefined,
  taxatiewaarde: undefined,
  taxatiedatum: undefined,
  verhuurStatus: 'leeg',
  aantalHuurders: undefined,
  leegstandPct: undefined,
  oppervlakte: undefined,
  oppervlakteVvo: undefined,
  oppervlakteBvo: undefined,
  oppervlakteGbo: undefined,
  perceelOppervlakte: undefined,
  bouwjaar: undefined,
  energielabel: undefined,
  energielabelV2: undefined,
  huidigGebruik: undefined,
  aantalVerdiepingen: undefined,
  aantalUnits: undefined,
  onderhoudsstaat: undefined,
  onderhoudsstaatNiveau: undefined,
  recenteInvesteringen: undefined,
  achterstalligOnderhoud: undefined,
  asbestinventarisatieAanwezig: false,
  eigendomssituatie: undefined,
  erfpachtinformatie: undefined,
  bestemmingsinformatie: undefined,
  kadastraleGemeente: undefined,
  kadastraleSectie: undefined,
  kadastraalNummer: undefined,
  ontwikkelPotentie: false,
  transformatiePotentie: false,
  samenvatting: undefined,
  investeringsthese: undefined,
  risicos: undefined,
  onderscheidendeKenmerken: undefined,
  verkoperNaam: undefined,
  verkoperRol: undefined,
  verkoperVia: 'onbekend',
  verkoperTelefoon: undefined,
  verkoperEmail: undefined,
  verkoopmotivatie: undefined,
  isPortefeuille: false,
  parentObjectId: undefined,
  documentenBeschikbaar: false,
  interneOpmerkingen: undefined,
  opmerkingen: undefined,
  referentieanalyseZichtbaar: true,
};

const ENERGIELABELS: Energielabel[] =
  ['A++++','A+++','A++','A+','A','B','C','D','E','F','G','onbekend'];

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------

export default function ObjectFormDialog({ open, onOpenChange, object }: Props) {
  const { addObject, updateObject, objecten, genereerRefnummer } = useDataStore();
  const isEdit = !!object;

  // Voor nieuw: we houden object-id bij na 1e opslag zodat media-tabs beschikbaar worden
  const [gemaaktId, setGemaaktId] = useState<string | undefined>(object?.id);
  const objectId = object?.id ?? gemaaktId;

  const [form, setForm] = useState<FormState>(leegForm);
  const [bezig, setBezig] = useState(false);
  const [tab, setTab] = useState('algemeen');
  // UI-only toggle: "Ook bruikbaar als referentieobject"
  // Wordt bewust niet in de database opgeslagen — dient als visuele hint
  // én als trigger voor het kwaliteitsblok. Een echt referentieobject
  // wordt apart aangemaakt via het Referentieobject-formulier.
  const [markeerAlsReferentie, setMarkeerAlsReferentie] = useState(false);

  // Hydreer form bij open
  useEffect(() => {
    if (object) {
      const { id, datumToegevoegd, softDeletedAt, ...rest } = object;
      setForm({ ...leegForm, ...rest });
      setGemaaktId(object.id);
    } else {
      setForm(leegForm);
      setGemaaktId(undefined);
    }
    setTab('algemeen');
    setMarkeerAlsReferentie(false);
  }, [object, open]);

  // Genereer referentienummer automatisch voor nieuwe objecten
  useEffect(() => {
    if (!open) return;
    if (object || gemaaktId) return;
    if (form.internReferentienummer) return;
    let cancelled = false;
    genereerRefnummer().then(nr => {
      if (!cancelled) {
        setForm(prev => prev.internReferentienummer ? prev : { ...prev, internReferentienummer: nr });
      }
    }).catch(() => { /* silent — veld blijft leeg en user kan zelf invullen */ });
    return () => { cancelled = true; };
  }, [open, object, gemaaktId, form.internReferentienummer, genereerRefnummer]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const num = (v: string): number | undefined => v === '' ? undefined : Number(v);

  // Wijzig type -> reset subcategorieId (is afhankelijk van type)
  const setType = (nieuwType: AssetClass) => {
    setForm(prev => ({ ...prev, type: nieuwType, subcategorieId: undefined }));
  };

  const handleSave = async () => {
    if (bezig) return;
    if (!form.titel.trim()) {
      toast.error('Titel is verplicht');
      setTab('algemeen');
      return;
    }
    setBezig(true);

    const data = {
      ...form,
      titel: form.titel.trim() || 'Onbekend object',
    };

    try {
      if (isEdit && object) {
        await updateObject(object.id, data);
        toast.success('Object bijgewerkt');
      } else if (gemaaktId) {
        // Al eens opgeslagen in deze sessie, nu extra wijzigingen
        await updateObject(gemaaktId, data);
        toast.success('Object bijgewerkt');
      } else {
        const payload = { ...data, datumToegevoegd: new Date().toISOString().split('T')[0] };
        const nieuw = await addObject(payload as any);
        if (nieuw?.id) {
          setGemaaktId(nieuw.id);
          toast.success('Object aangemaakt — je kunt nu huurders, documenten en foto\'s toevoegen');
        }
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Opslaan mislukt');
    } finally {
      setBezig(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  // Parent-object opties voor portefeuille-structuur
  const parentOpties = objecten.filter(o =>
    o.isPortefeuille && o.id !== (object?.id ?? gemaaktId)
  );

  // Referentiekwaliteit op basis van objectvelden
  const refKwaliteit = useMemo(() => berekenObjectReferentieKwaliteit({
    adres: form.adres,
    postcode: form.postcode,
    plaats: form.plaats,
    type: form.type,
    oppervlakte: form.oppervlakte,
    vraagprijs: form.vraagprijs,
    bouwjaar: form.bouwjaar,
    energielabelV2: form.energielabelV2,
    verhuurStatus: form.verhuurStatus,
    bron: form.bron,
    perceelOppervlakte: form.perceelOppervlakte,
    onderhoudsstaatNiveau: form.onderhoudsstaatNiveau,
    huurPerM2: form.huurPerM2,
  }), [
    form.adres, form.postcode, form.plaats, form.type, form.oppervlakte,
    form.vraagprijs, form.bouwjaar, form.energielabelV2, form.verhuurStatus,
    form.bron, form.perceelOppervlakte, form.onderhoudsstaatNiveau, form.huurPerM2,
  ]);

  const kwaliteitKleur =
    refKwaliteit.qualityScore >= 75 ? 'text-success'
    : refKwaliteit.qualityScore >= 60 ? 'text-warning'
    : 'text-destructive';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b border-border">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <DialogTitle>
              {isEdit ? 'Object bewerken' : (gemaaktId ? 'Object bewerken' : 'Nieuw object')}
            </DialogTitle>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <BookMarked className="h-3.5 w-3.5" />
              <span>Ook bruikbaar als referentieobject</span>
              <Switch
                checked={markeerAlsReferentie}
                onCheckedChange={setMarkeerAlsReferentie}
              />
            </label>
          </div>
        </DialogHeader>

        {markeerAlsReferentie && (
          <div className="shrink-0 px-6 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <div className="flex items-center gap-2">
                <BookMarked className="h-4 w-4 text-accent" />
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Referentiekwaliteit <span className="normal-case text-muted-foreground/80">(indicatie voor later referentiegebruik)</span>
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className={`font-semibold ${kwaliteitKleur}`}>
                  {REFERENTIE_KWALITEIT_LABELS[refKwaliteit.kwaliteit]} ·{' '}
                  <span className="font-mono-data">{refKwaliteit.qualityScore}/100</span>
                </span>
                <span className="text-muted-foreground">
                  Volledigheid: <span className="font-mono-data text-foreground">{refKwaliteit.completenessPct}%</span>
                </span>
              </div>
            </div>
            <Progress value={refKwaliteit.qualityScore} className="h-1.5 mb-2" />
            {(refKwaliteit.ontbrekendeAanbevolen.length > 0 || refKwaliteit.ontbrekendeNuttig.length > 0) ? (
              <div className="space-y-1 text-xs">
                {refKwaliteit.ontbrekendeAanbevolen.length > 0 && (
                  <div className="flex items-start gap-1.5 text-foreground">
                    <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                    <span>
                      Sterk aanbevolen ontbreekt:{' '}
                      <span className="text-muted-foreground">{refKwaliteit.ontbrekendeAanbevolen.join(', ')}</span>
                    </span>
                  </div>
                )}
                {refKwaliteit.ontbrekendeNuttig.length > 0 && (
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Nuttig ontbreekt: <span>{refKwaliteit.ontbrekendeNuttig.join(', ')}</span>
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Alle relevante velden ingevuld — sterk geschikt als referentieobject.
              </div>
            )}
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-6 pt-3 border-b border-border overflow-x-auto bg-background">
            <TabsList className="inline-flex">
              <TabsTrigger value="algemeen">Algemeen</TabsTrigger>
              <TabsTrigger value="financieel">Financieel</TabsTrigger>
              <TabsTrigger value="verhuur">Verhuur</TabsTrigger>
              <TabsTrigger value="pand">Pand</TabsTrigger>
              <TabsTrigger value="juridisch">Juridisch</TabsTrigger>
              <TabsTrigger value="verkoper">Verkoper</TabsTrigger>
              <TabsTrigger value="thesis">Thesis</TabsTrigger>
              <TabsTrigger value="media" disabled={!objectId}>
                <span className="hidden sm:inline">Media</span>
                <Image className="h-4 w-4 sm:hidden" />
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {/* TAB 1: ALGEMEEN */}
            <TabsContent value="algemeen" className="space-y-5 mt-0">
              <Sectie titel="Identificatie">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Titel *" span={2}>
                    <Input
                      value={form.titel}
                      onChange={e => set('titel', e.target.value)}
                      placeholder="bv. Woningportefeuille Amsterdam-West"
                    />
                  </Veld>
                  <Veld label="Intern referentienummer">
                    <Input
                      value={form.internReferentienummer ?? ''}
                      onChange={e => set('internReferentienummer', e.target.value || undefined)}
                      placeholder="BITO-YYYY-NNN (wordt automatisch gegenereerd)"
                    />
                  </Veld>
                  <Veld label="Status">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.status}
                      onChange={e => set('status', e.target.value as ObjectStatus)}
                    >
                      <option value="off-market">Off-market</option>
                      <option value="in_onderzoek">In onderzoek</option>
                      <option value="beschikbaar">Beschikbaar</option>
                      <option value="onder_optie">Onder optie</option>
                      <option value="verkocht">Verkocht</option>
                      <option value="ingetrokken">Ingetrokken</option>
                    </select>
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Anonimiteit">
                <div className="p-3 bg-muted/40 rounded-md flex items-start gap-2 mb-3">
                  <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Default aan — bij off-market is het verstandig het werkelijke adres
                    intern te houden. De publieke naam/regio kan worden getoond op
                    1-pagers zonder de eigenaar prijs te geven.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.anoniem}
                      onCheckedChange={v => set('anoniem', !!v)}
                    />
                    Anoniem presenteren
                  </label>
                  <div />
                  <Veld label="Publieke naam (voor 1-pager)">
                    <Input
                      value={form.publiekeNaam ?? ''}
                      onChange={e => set('publiekeNaam', e.target.value || undefined)}
                      placeholder="bv. Woonpand grachtengordel"
                      disabled={!form.anoniem}
                    />
                  </Veld>
                  <Veld label="Publieke regio">
                    <Input
                      value={form.publiekeRegio ?? ''}
                      onChange={e => set('publiekeRegio', e.target.value || undefined)}
                      placeholder="bv. Randstad-Noord"
                      disabled={!form.anoniem}
                    />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Locatie">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label={<>Adres<RefMark level="sterk" show={markeerAlsReferentie} /></>}>
                    <Input value={form.adres ?? ''} onChange={e => set('adres', e.target.value || undefined)} />
                  </Veld>
                  <Veld label={<>Postcode<RefMark level="sterk" show={markeerAlsReferentie} /></>}>
                    <Input value={form.postcode ?? ''} onChange={e => set('postcode', e.target.value || undefined)} />
                  </Veld>
                  <Veld label={<>Plaats<RefMark level="sterk" show={markeerAlsReferentie} /></>}>
                    <Input value={form.plaats} onChange={e => set('plaats', e.target.value)} />
                  </Veld>
                  <Veld label="Provincie">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.provincie}
                      onChange={e => set('provincie', e.target.value)}
                    >
                      <option value="">— Kies provincie —</option>
                      {PROVINCIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Classificatie">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label={<>Type vastgoed<RefMark level="sterk" show={markeerAlsReferentie} /></>}>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.type}
                      onChange={e => setType(e.target.value as AssetClass)}
                    >
                      {Object.entries(ASSET_CLASS_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Veld>
                  <Veld label="Subcategorie">
                    <SubcategorieSelect
                      assetClass={form.type}
                      value={form.subcategorieId}
                      onChange={id => set('subcategorieId', id)}
                    />
                  </Veld>
                  <Veld label="Beschikbaar vanaf">
                    <Input
                      type="date"
                      value={form.beschikbaarVanaf ?? ''}
                      onChange={e => set('beschikbaarVanaf', e.target.value || undefined)}
                    />
                  </Veld>
                  <Veld label="Huidig gebruik">
                    <Input
                      value={form.huidigGebruik ?? ''}
                      onChange={e => set('huidigGebruik', e.target.value || undefined)}
                      placeholder="bv. verhuurd aan supermarkt"
                    />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Portefeuille & bron">
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.isPortefeuille}
                      onCheckedChange={v => set('isPortefeuille', !!v)}
                    />
                    Dit is een portefeuille
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.exclusief}
                      onCheckedChange={v => set('exclusief', !!v)}
                    />
                    Exclusief aangeboden
                  </label>
                  {parentOpties.length > 0 && (
                    <Veld label="Onderdeel van portefeuille">
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={form.parentObjectId ?? ''}
                        onChange={e => set('parentObjectId', e.target.value || undefined)}
                      >
                        <option value="">— Geen —</option>
                        {parentOpties.map(o => (
                          <option key={o.id} value={o.id}>{o.titel}</option>
                        ))}
                      </select>
                    </Veld>
                  )}
                  <Veld label={<>Bron<RefMark level="nuttig" show={markeerAlsReferentie} /></>}>
                    <Input
                      value={form.bron ?? ''}
                      onChange={e => set('bron', e.target.value || undefined)}
                      placeholder="bv. eigen netwerk, makelaar X"
                    />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Weergave">
                <label className="flex items-start gap-2 p-3 rounded-md bg-muted/30 cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.referentieanalyseZichtbaar !== false}
                    onChange={e => set('referentieanalyseZichtbaar', e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input shrink-0 cursor-pointer accent-accent"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Referentieanalyse tonen</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Toon marktwaarde-indicatie en gekoppelde referentieobjecten op de object-detail pagina.
                    </p>
                  </div>
                </label>
              </Sectie>
            </TabsContent>

            {/* TAB 2: FINANCIEEL */}
            <TabsContent value="financieel" className="space-y-5 mt-0">
              <Sectie titel="Prijs">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label={<>Vraagprijs (€)<RefMark level="sterk" show={markeerAlsReferentie} /></>}>
                    <Input type="number" value={form.vraagprijs ?? ''}
                      onChange={e => set('vraagprijs', num(e.target.value))} />
                  </Veld>
                  <Veld label="Prijsindicatie (tekstueel)">
                    <Input value={form.prijsindicatie ?? ''}
                      onChange={e => set('prijsindicatie', e.target.value || undefined)}
                      placeholder="bv. op aanvraag, koers € 5-6 mln" />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Huur & rendement">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Totale huurinkomsten (€/jr)">
                    <Input type="number" value={form.huurinkomsten ?? ''}
                      onChange={e => set('huurinkomsten', num(e.target.value))} />
                  </Veld>
                  <Veld label={<>Huur per m² (€)<RefMark level="nuttig" show={markeerAlsReferentie} /></>}>
                    <Input type="number" step="0.01" value={form.huurPerM2 ?? ''}
                      onChange={e => set('huurPerM2', num(e.target.value))} />
                  </Veld>
                  <Veld label="Servicekosten (€/jr)">
                    <Input type="number" value={form.servicekostenJaar ?? ''}
                      onChange={e => set('servicekostenJaar', num(e.target.value))} />
                  </Veld>
                  <Veld label="NOI — netto operationeel inkomen (€/jr)">
                    <Input type="number" value={form.noi ?? ''}
                      onChange={e => set('noi', num(e.target.value))} />
                  </Veld>
                  <Veld label="BAR — bruto aanvangsrendement (%)">
                    <Input type="number" step="0.01" value={form.brutoAanvangsrendement ?? ''}
                      onChange={e => set('brutoAanvangsrendement', num(e.target.value))} />
                  </Veld>
                  <Veld label="NAR — netto aanvangsrendement (%)">
                    <Input type="number" step="0.01" value={form.nettoAanvangsrendement ?? ''}
                      onChange={e => set('nettoAanvangsrendement', num(e.target.value))} />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Waarderingen">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="WOZ-waarde (€)">
                    <Input type="number" value={form.wozWaarde ?? ''}
                      onChange={e => set('wozWaarde', num(e.target.value))} />
                  </Veld>
                  <Veld label="WOZ peildatum">
                    <Input type="date" value={form.wozPeildatum ?? ''}
                      onChange={e => set('wozPeildatum', e.target.value || undefined)} />
                  </Veld>
                  <Veld label="Taxatiewaarde (€)">
                    <Input type="number" value={form.taxatiewaarde ?? ''}
                      onChange={e => set('taxatiewaarde', num(e.target.value))} />
                  </Veld>
                  <Veld label="Taxatiedatum">
                    <Input type="date" value={form.taxatiedatum ?? ''}
                      onChange={e => set('taxatiedatum', e.target.value || undefined)} />
                  </Veld>
                </div>
              </Sectie>
            </TabsContent>

            {/* TAB 3: VERHUUR */}
            <TabsContent value="verhuur" className="space-y-5 mt-0">
              <Sectie titel="Verhuurstatus">
                <div className="grid sm:grid-cols-3 gap-4">
                  <Veld label={<>Status<RefMark level="nuttig" show={markeerAlsReferentie} /></>}>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.verhuurStatus}
                      onChange={e => set('verhuurStatus', e.target.value as VerhuurStatus)}
                    >
                      <option value="verhuurd">Verhuurd</option>
                      <option value="gedeeltelijk">Gedeeltelijk</option>
                      <option value="leeg">Leeg</option>
                    </select>
                  </Veld>
                  <Veld label="Aantal huurders (aggregaat)">
                    <Input type="number" value={form.aantalHuurders ?? ''}
                      onChange={e => set('aantalHuurders', num(e.target.value))}
                      placeholder="Automatisch: onderstaand beheer" />
                  </Veld>
                  <Veld label="Leegstand (%)">
                    <Input type="number" step="0.1" value={form.leegstandPct ?? ''}
                      onChange={e => set('leegstandPct', num(e.target.value))} />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Huurders">
                {objectId ? (
                  <HuurdersPanel objectId={objectId} />
                ) : (
                  <PlaceholderEerstOpslaan
                    icon={<Users className="h-6 w-6" />}
                    boodschap="Sla het object eerst op om huurders toe te voegen."
                  />
                )}
              </Sectie>
            </TabsContent>

            {/* TAB 4: PAND */}
            <TabsContent value="pand" className="space-y-5 mt-0">
              <Sectie titel="Oppervlakten (NEN 2580)">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label={<>Oppervlakte totaal (m²)<RefMark level="sterk" show={markeerAlsReferentie} /></>}>
                    <Input type="number" value={form.oppervlakte ?? ''}
                      onChange={e => set('oppervlakte', num(e.target.value))} />
                  </Veld>
                  <Veld label="VVO — verhuurbaar vloeroppervlak (m²)">
                    <Input type="number" value={form.oppervlakteVvo ?? ''}
                      onChange={e => set('oppervlakteVvo', num(e.target.value))} />
                  </Veld>
                  <Veld label="BVO — bruto vloeroppervlak (m²)">
                    <Input type="number" value={form.oppervlakteBvo ?? ''}
                      onChange={e => set('oppervlakteBvo', num(e.target.value))} />
                  </Veld>
                  <Veld label="GBO — gebruiksoppervlak (m²)">
                    <Input type="number" value={form.oppervlakteGbo ?? ''}
                      onChange={e => set('oppervlakteGbo', num(e.target.value))} />
                  </Veld>
                  <Veld label={<>Perceeloppervlak (m²)<RefMark level="nuttig" show={markeerAlsReferentie} /></>}>
                    <Input type="number" value={form.perceelOppervlakte ?? ''}
                      onChange={e => set('perceelOppervlakte', num(e.target.value))} />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Bouw">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label={<>Bouwjaar<RefMark level="sterk" show={markeerAlsReferentie} /></>}>
                    <Input type="number" value={form.bouwjaar ?? ''}
                      onChange={e => set('bouwjaar', num(e.target.value))} />
                  </Veld>
                  <Veld label={<>Energielabel<RefMark level="nuttig" show={markeerAlsReferentie} /></>}>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.energielabelV2 ?? ''}
                      onChange={e => set('energielabelV2', (e.target.value || undefined) as Energielabel | undefined)}
                    >
                      <option value="">— Onbekend —</option>
                      {ENERGIELABELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </Veld>
                  <Veld label="Aantal verdiepingen">
                    <Input type="number" value={form.aantalVerdiepingen ?? ''}
                      onChange={e => set('aantalVerdiepingen', num(e.target.value))} />
                  </Veld>
                  <Veld label="Aantal units">
                    <Input type="number" value={form.aantalUnits ?? ''}
                      onChange={e => set('aantalUnits', num(e.target.value))} />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Onderhoud">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label={<>Onderhoudsstaat<RefMark level="nuttig" show={markeerAlsReferentie} /></>}>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.onderhoudsstaatNiveau ?? ''}
                      onChange={e => set('onderhoudsstaatNiveau', (e.target.value || undefined) as OnderhoudsstaatNiveau | undefined)}
                    >
                      <option value="">— Onbekend —</option>
                      {Object.entries(ONDERHOUDSSTAAT_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Veld>
                  <label className="flex items-center gap-2 text-sm self-end pb-2">
                    <Checkbox
                      checked={form.asbestinventarisatieAanwezig ?? false}
                      onCheckedChange={v => set('asbestinventarisatieAanwezig', !!v)}
                    />
                    Asbestinventarisatie aanwezig
                  </label>
                  <Veld label="Recente investeringen" span={2}>
                    <Textarea rows={2} value={form.recenteInvesteringen ?? ''}
                      onChange={e => set('recenteInvesteringen', e.target.value || undefined)}
                      placeholder="bv. dak 2022, CV 2024" />
                  </Veld>
                  <Veld label="Achterstallig onderhoud" span={2}>
                    <Textarea rows={2} value={form.achterstalligOnderhoud ?? ''}
                      onChange={e => set('achterstalligOnderhoud', e.target.value || undefined)} />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Potentie">
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.ontwikkelPotentie}
                      onCheckedChange={v => set('ontwikkelPotentie', !!v)} />
                    Ontwikkelpotentie
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.transformatiePotentie}
                      onCheckedChange={v => set('transformatiePotentie', !!v)} />
                    Transformatiepotentie
                  </label>
                </div>
              </Sectie>
            </TabsContent>

            {/* TAB 5: JURIDISCH */}
            <TabsContent value="juridisch" className="space-y-5 mt-0">
              <Sectie titel="Eigendom & erfpacht">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Eigendomssituatie">
                    <Input value={form.eigendomssituatie ?? ''}
                      onChange={e => set('eigendomssituatie', e.target.value || undefined)}
                      placeholder="vol eigendom / erfpacht / ..." />
                  </Veld>
                </div>
                <Veld label="Erfpachtinformatie">
                  <Textarea rows={2} value={form.erfpachtinformatie ?? ''}
                    onChange={e => set('erfpachtinformatie', e.target.value || undefined)} />
                </Veld>
                <Veld label="Bestemmingsinformatie">
                  <Textarea rows={2} value={form.bestemmingsinformatie ?? ''}
                    onChange={e => set('bestemmingsinformatie', e.target.value || undefined)}
                    placeholder="bv. gemengde bestemming, planologie" />
                </Veld>
              </Sectie>

              <Sectie titel="Kadaster">
                <div className="grid sm:grid-cols-3 gap-4">
                  <Veld label="Kadastrale gemeente">
                    <Input value={form.kadastraleGemeente ?? ''}
                      onChange={e => set('kadastraleGemeente', e.target.value || undefined)} />
                  </Veld>
                  <Veld label="Sectie">
                    <Input value={form.kadastraleSectie ?? ''}
                      onChange={e => set('kadastraleSectie', e.target.value || undefined)} />
                  </Veld>
                  <Veld label="Perceel-/kadastraal nummer">
                    <Input value={form.kadastraalNummer ?? ''}
                      onChange={e => set('kadastraalNummer', e.target.value || undefined)} />
                  </Veld>
                </div>
              </Sectie>
            </TabsContent>

            {/* TAB 6: VERKOPER */}
            <TabsContent value="verkoper" className="space-y-5 mt-0">
              <Sectie titel="Verkoper / contact">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Verkoper naam">
                    <Input value={form.verkoperNaam ?? ''}
                      onChange={e => set('verkoperNaam', e.target.value || undefined)} />
                  </Veld>
                  <Veld label="Rol">
                    <Input value={form.verkoperRol ?? ''}
                      onChange={e => set('verkoperRol', e.target.value || undefined)}
                      placeholder="eigenaar, beheerder, adviseur, ..." />
                  </Veld>
                  <Veld label="Via">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.verkoperVia ?? 'onbekend'}
                      onChange={e => set('verkoperVia', e.target.value as VerkoperVia)}
                    >
                      {Object.entries(VERKOPER_VIA_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Veld>
                  <Veld label="Telefoon">
                    <Input value={form.verkoperTelefoon ?? ''}
                      onChange={e => set('verkoperTelefoon', e.target.value || undefined)} />
                  </Veld>
                  <Veld label="E-mail">
                    <Input type="email" value={form.verkoperEmail ?? ''}
                      onChange={e => set('verkoperEmail', e.target.value || undefined)} />
                  </Veld>
                </div>
                <Veld label="Verkoopmotivatie">
                  <Textarea rows={2} value={form.verkoopmotivatie ?? ''}
                    onChange={e => set('verkoopmotivatie', e.target.value || undefined)}
                    placeholder="waarom wil de verkoper van het object af" />
                </Veld>
              </Sectie>
            </TabsContent>

            {/* TAB 7: THESIS */}
            <TabsContent value="thesis" className="space-y-5 mt-0">
              <Sectie titel="Samenvatting (voor 1-pager)">
                <Veld label="Samenvatting">
                  <Textarea rows={3} value={form.samenvatting ?? ''}
                    onChange={e => set('samenvatting', e.target.value || undefined)}
                    placeholder="Korte omschrijving van het object zoals getoond op de 1-pager" />
                </Veld>
              </Sectie>

              <Sectie titel="Investeringsthese">
                <Veld label="Waarom interessant (bullets)">
                  <Textarea rows={5} value={form.investeringsthese ?? ''}
                    onChange={e => set('investeringsthese', e.target.value || undefined)}
                    placeholder={'- Sterke locatie\n- Stabiele kasstroom\n- Transformatiepotentie'} />
                </Veld>
                <Veld label="Onderscheidende kenmerken">
                  <Textarea rows={2} value={form.onderscheidendeKenmerken ?? ''}
                    onChange={e => set('onderscheidendeKenmerken', e.target.value || undefined)} />
                </Veld>
              </Sectie>

              <Sectie titel="Risico's">
                <Veld label="Risico's (bullets)">
                  <Textarea rows={4} value={form.risicos ?? ''}
                    onChange={e => set('risicos', e.target.value || undefined)}
                    placeholder={'- Korte WALT\n- Achterstallig onderhoud\n- Afhankelijk van 1 huurder'} />
                </Veld>
              </Sectie>

              <Sectie titel="Interne notities">
                <Veld label="Opmerkingen (extern)">
                  <Textarea rows={2} value={form.opmerkingen ?? ''}
                    onChange={e => set('opmerkingen', e.target.value || undefined)} />
                </Veld>
                <Veld label="Interne opmerkingen (alleen Bito)">
                  <Textarea rows={2} value={form.interneOpmerkingen ?? ''}
                    onChange={e => set('interneOpmerkingen', e.target.value || undefined)} />
                </Veld>
              </Sectie>
            </TabsContent>

            {/* TAB 8: MEDIA */}
            <TabsContent value="media" className="space-y-6 mt-0">
              {objectId ? (
                <>
                  <Sectie titel="Foto's">
                    <FotosPanel objectId={objectId} />
                  </Sectie>
                  <Sectie titel="Documenten">
                    <DocumentenPanel objectId={objectId} />
                  </Sectie>
                </>
              ) : (
                <PlaceholderEerstOpslaan
                  icon={<FileText className="h-6 w-6" />}
                  boodschap="Sla het object eerst op om foto's en documenten te uploaden."
                />
              )}
            </TabsContent>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border px-6 py-3 flex justify-between items-center gap-3 bg-background">
            <p className="text-xs text-muted-foreground hidden sm:block">
              {isEdit || gemaaktId ? 'Wijzigingen worden direct opgeslagen na klikken' : 'Eerst opslaan om media toe te voegen'}
            </p>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={handleClose}>
                {(isEdit || gemaaktId) ? 'Sluiten' : 'Annuleren'}
              </Button>
              <Button onClick={handleSave} disabled={bezig}>
                {bezig ? 'Bezig…' : (isEdit || gemaaktId ? 'Opslaan' : 'Aanmaken')}
              </Button>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}


// ---------------------------------------------------------------------
// Sub-componenten — layout helpers
// ---------------------------------------------------------------------

function Sectie({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1.5">
        {titel}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Veld({ label, children, span = 1 }: { label: ReactNode; children: ReactNode; span?: 1 | 2 }) {
  return (
    <div className={`space-y-1.5 ${span === 2 ? 'sm:col-span-2' : ''}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Visuele markering: ** = sterk aanbevolen voor referentiegebruik, * = nuttig. */
function RefMark({ level, show }: { level: 'sterk' | 'nuttig'; show: boolean }) {
  if (!show) return null;
  return (
    <span
      className={`ml-1 ${level === 'sterk' ? 'text-accent font-semibold' : 'text-muted-foreground'}`}
      title={level === 'sterk'
        ? 'Sterk aanbevolen om dit object later als referentie te kunnen gebruiken'
        : 'Nuttig voor referentiegebruik'}
    >
      {level === 'sterk' ? '**' : '*'}
    </span>
  );
}

function PlaceholderEerstOpslaan({
  icon, boodschap,
}: { icon: ReactNode; boodschap: string }) {
  return (
    <div className="border border-dashed border-border rounded-md p-8 text-center">
      <div className="text-muted-foreground inline-flex">{icon}</div>
      <p className="text-sm text-muted-foreground mt-2">{boodschap}</p>
    </div>
  );
}
