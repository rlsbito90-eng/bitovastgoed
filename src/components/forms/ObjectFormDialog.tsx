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

import { useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { useFormDirtyGuard } from '@/hooks/useFormDirtyGuard';
import { useResetScrollOnChange } from '@/hooks/useResetScrollOnChange';
import { maandhuurFromJaar, jaarFromMaandhuur, huurPerM2 as calcHuurPerM2, bar as calcBar, kapitalisatiefactor as calcFactor, formatFactor, fmtEuroNL, fmtPctNL } from '@/lib/financialCalc';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NumberField } from '@/components/ui/number-field';
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
import MultiSelectChips from '@/components/object/MultiSelectChips';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import { propertyTypeSlugNaarAssetClass } from '@/lib/taxonomie-mapping';
import { Info, Image, FileText, Users, AlertCircle, AlertTriangle, CheckCircle2, BookMarked, FileSignature, Plus, Trash2 } from 'lucide-react';
import { DOCUMENT_TYPE_LABELS } from '@/data/mock-data';
import type { DocumentType } from '@/data/mock-data';
import ArchiveerDialog from '@/components/ArchiveerDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  object?: ObjectVastgoed | null;
  /** Tab waarop de dialog standaard opent. Default: 'algemeen'. */
  initialTab?: string;
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
  propertyTypeId: undefined,
  propertySubtypeIds: [],
  dealTypeIds: [],
  status: 'te_beoordelen',
  aanbiedingswijze: 'off_market',
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
  potentieOmschrijving: undefined,
  potentieStrategie: undefined,
  potentieExtraM2: undefined,
  potentieExtraUnits: undefined,
  potentieOnderbouwingStatus: undefined,
  potentieAfhankelijkheden: undefined,
  potentieBron: undefined,
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
  markeerAlsReferentie: false,
  interneOpmerkingen: undefined,
  opmerkingen: undefined,
  referentieanalyseZichtbaar: true,
  // IM-content
  propositie: undefined,
  objectomschrijving: undefined,
  locatieOmschrijving: undefined,
  technischeStaatOmschrijving: undefined,
  procesVoorwaarden: undefined,
  dataroomUrl: undefined,
  marktwaardeIndicatie: undefined,
  marktwaardeBron: undefined,
  contactNaam: undefined,
  contactFunctie: undefined,
  contactTelefoon: undefined,
  contactEmail: undefined,
  oppervlaktenPerVerdieping: [],
  financieleScenarios: {},
  documentatieStatus: {},
  imSectiesZichtbaar: {},
};

// IM-secties die de gebruiker per stuk aan/uit kan zetten in het document
const IM_SECTIES: { key: string; label: string }[] = [
  { key: 'propositie',     label: 'Propositie' },
  { key: 'object',         label: 'Objectomschrijving' },
  { key: 'locatie',        label: 'Locatie' },
  { key: 'oppervlakten',   label: 'Oppervlakten per verdieping' },
  { key: 'huur',           label: 'Huurinformatie' },
  { key: 'financieel',     label: 'Financiële scenario\'s' },
  { key: 'marktwaarde',    label: 'Marktwaarde-indicatie' },
  { key: 'technisch',      label: 'Technische staat' },
  { key: 'juridisch',      label: 'Juridisch & kadaster' },
  { key: 'duurzaamheid',   label: 'Duurzaamheid / energielabel' },
  { key: 'risicos',        label: 'Risico\'s' },
  { key: 'documentatie',   label: 'Documentatie-overzicht' },
  { key: 'proces',         label: 'Proces & voorwaarden' },
  { key: 'contact',        label: 'Contact' },
];

const ENERGIELABELS: Energielabel[] =
  ['A++++','A+++','A++','A+','A','B','C','D','E','F','G','onbekend'];

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------

export default function ObjectFormDialog({ open, onOpenChange, object, initialTab = 'algemeen' }: Props) {
  const { addObject, updateObject, objecten, genereerRefnummer } = useDataStore();
  const isEdit = !!object;

  // Voor nieuw: we houden object-id bij na 1e opslag zodat media-tabs beschikbaar worden
  const [gemaaktId, setGemaaktId] = useState<string | undefined>(object?.id);
  const objectId = object?.id ?? gemaaktId;

  const [form, setForm] = useState<FormState>(leegForm);
  const [bezig, setBezig] = useState(false);
  const [tab, setTab] = useState(initialTab);

  // Reset tab alleen bij een echte open-transitie (false → true). Hierdoor
  // valt de tab niet terug naar 'algemeen' wanneer de parent re-rendert na
  // store.refresh (bijv. na document-upload of type-wijziging).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setTab(initialTab);
    }
    wasOpenRef.current = open;
  }, [open, initialTab]);
  // Persistente toggle: "Ook bruikbaar als referentieobject".
  // Wordt opgeslagen op het object zelf en kan in een latere fase gebruikt
  // worden als bron voor de referentie-analyse.
  const markeerAlsReferentie = !!form.markeerAlsReferentie;
  const setMarkeerAlsReferentie = (v: boolean) => set('markeerAlsReferentie', v);

  // Raw input state voor financiële berekeningen — voorkomt cursor-jumps
  // en houdt twee-richtings koppeling tussen maandhuur ↔ jaarhuur soepel.
  const [maandhuurInput, setMaandhuurInput] = useState<string>('');
  const [laatstGewijzigdHuur, setLaatstGewijzigdHuur] = useState<'maand' | 'jaar' | null>(null);
  // Was huur/m² handmatig ingevuld? Zo niet: blijft volledig afgeleid van jaarhuur ÷ m².
  const [huurPerM2Manual, setHuurPerM2Manual] = useState(false);

  // Scroll-container ref: bij tabwissel scrollt deze automatisch naar boven.
  const scrollRef = useResetScrollOnChange(tab);

  // Hydreer form alleen bij open-transitie of wanneer een ander object wordt
  // bewerkt (object?.id verandert). Bewust NIET op iedere nieuwe object-
  // referentie: anders overschrijft elke store.refresh (na upload, document-
  // type-wijziging, foto-mutatie) de in-progress form-state en/of zorgt voor
  // ongewenste UI-resets (zoals de Media-tab die disabled wordt wanneer
  // objectId kort undefined is).
  const hydratedForRef = useRef<{ open: boolean; id: string | undefined }>({ open: false, id: undefined });
  useEffect(() => {
    if (!open) {
      hydratedForRef.current = { open: false, id: undefined };
      return;
    }
    const currentId = object?.id;
    const alreadyHydrated = hydratedForRef.current.open && hydratedForRef.current.id === currentId;
    if (alreadyHydrated) return;
    hydratedForRef.current = { open: true, id: currentId };

    if (object) {
      const { id, datumToegevoegd, softDeletedAt, ...rest } = object;
      setForm({ ...leegForm, ...rest });
      setGemaaktId(object.id);
      setHuurPerM2Manual(object.huurPerM2 != null);
    } else {
      setForm(leegForm);
      setGemaaktId(undefined);
      setHuurPerM2Manual(false);
    }
    setMaandhuurInput(object?.huurinkomsten ? String(Math.round(object.huurinkomsten / 12 * 100) / 100) : '');
    setLaatstGewijzigdHuur(null);
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

  const { propertyTypes, subtypesForType, dealTypes, propertyTypeById } = usePropertyTaxonomie();

  const num = (v: string): number | undefined => v === '' ? undefined : Number(v);

  // Wijzig property_type -> reset subtypes + sync legacy AssetClass enum
  const setPropertyType = (newId: string | undefined) => {
    setForm(prev => {
      const pt = newId ? propertyTypes.find(p => p.id === newId) : undefined;
      const newAssetClass = pt ? propertyTypeSlugNaarAssetClass(pt.slug) : prev.type;
      return {
        ...prev,
        propertyTypeId: newId,
        propertySubtypeIds: [],
        // Houd legacy `type` (AssetClass) gesynchroniseerd zodat bestaande
        // filters/matching/badges blijven werken zonder breuk.
        type: newAssetClass,
        subcategorieId: undefined,
      };
    });
  };

  // Archief-modal state — opent vóór save bij eindstatus
  const [archiefOpen, setArchiefOpen] = useState(false);

  const finalStatussen: ObjectStatus[] = ['verkocht', 'ingetrokken', 'afgevallen'];
  const defaultReasonVoorStatus = (s: ObjectStatus): string => {
    if (s === 'verkocht') return 'Verkocht via Bito Vastgoed';
    if (s === 'ingetrokken') return 'Ingetrokken door eigenaar';
    return 'Succesvol afgerond';
  };

  const persist = async (extra: Partial<ObjectVastgoed> = {}, archiefMelding?: string) => {
    setBezig(true);
    const data = {
      ...form,
      ...extra,
      titel: form.titel.trim() || 'Onbekend object',
    };
    try {
      if (isEdit && object) {
        await updateObject(object.id, data);
        toast.success(archiefMelding ?? 'Object bijgewerkt');
        onOpenChange(false);
      } else if (gemaaktId) {
        await updateObject(gemaaktId, data);
        toast.success(archiefMelding ?? 'Object bijgewerkt');
        onOpenChange(false);
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

  const handleSave = async () => {
    if (bezig) return;
    if (!form.titel.trim()) {
      toast.error('Titel is verplicht');
      setTab('algemeen');
      return;
    }
    const triggertArchief = finalStatussen.includes(form.status)
      && (!object || !object.isArchived);
    if (triggertArchief) {
      setArchiefOpen(true);
      return;
    }
    await persist();
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

  const { guardedOnOpenChange } = useFormDirtyGuard(open, form, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] max-h-[95dvh] p-0 gap-0 flex flex-col overflow-hidden overflow-x-hidden">
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
          <div className="shrink-0 px-3 sm:px-6 pt-3 pb-2 border-b border-border bg-background overflow-x-auto no-scrollbar">
            <TabsList className="inline-flex h-auto p-1 gap-1 bg-transparent rounded-full glass-card border border-border/60">
              <TabsTrigger value="algemeen" className="modal-tab-pill data-[state=active]:shadow-none">Algemeen</TabsTrigger>
              <TabsTrigger value="financieel" className="modal-tab-pill data-[state=active]:shadow-none">Financieel</TabsTrigger>
              <TabsTrigger value="verhuur" className="modal-tab-pill data-[state=active]:shadow-none">Verhuur</TabsTrigger>
              <TabsTrigger value="pand" className="modal-tab-pill data-[state=active]:shadow-none">Pand</TabsTrigger>
              <TabsTrigger value="potentie" className="modal-tab-pill data-[state=active]:shadow-none">Potentie</TabsTrigger>
              <TabsTrigger value="juridisch" className="modal-tab-pill data-[state=active]:shadow-none">Juridisch</TabsTrigger>
              <TabsTrigger value="contacten" className="modal-tab-pill data-[state=active]:shadow-none">Contacten</TabsTrigger>
              <TabsTrigger value="aanbieding" className="modal-tab-pill data-[state=active]:shadow-none">Aanbieding &amp; dossier</TabsTrigger>
              <TabsTrigger value="media" disabled={!objectId} className="modal-tab-pill data-[state=active]:shadow-none">
                <span className="hidden sm:inline">Media</span>
                <Image className="h-4 w-4 sm:hidden" />
              </TabsTrigger>
            </TabsList>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 min-h-0">

            {/* TAB 1: ALGEMEEN */}
            <TabsContent value="algemeen" className="space-y-5 mt-0">
              <Sectie titel="Identificatie">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Titel *" span={2}>
                    <Input
                      value={form.titel}
                      onChange={e => set('titel', e.target.value)}
                      placeholder="bv. Voorbeeldportefeuille"
                    />
                  </Veld>
                  <Veld label="Intern referentienummer">
                    <Input
                      value={form.internReferentienummer ?? ''}
                      onChange={e => set('internReferentienummer', e.target.value || undefined)}
                      placeholder="BITO-YYYY-NNN (wordt automatisch gegenereerd)"
                    />
                  </Veld>
                  <Veld label="Objectstatus">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.status}
                      onChange={e => set('status', e.target.value as ObjectStatus)}
                    >
                      <option value="te_beoordelen">Te beoordelen</option>
                      <option value="beschikbaar">Beschikbaar</option>
                      <option value="on_hold">On hold</option>
                      <option value="onder_optie">Onder optie</option>
                      <option value="verkocht">Verkocht</option>
                      <option value="ingetrokken">Ingetrokken</option>
                      <option value="afgevallen">Afgevallen</option>
                    </select>
                  </Veld>
                  <Veld label="Aanbiedingswijze">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.aanbiedingswijze ?? 'off_market'}
                      onChange={e => set('aanbiedingswijze', e.target.value as any)}
                    >
                      <option value="off_market">Off-market</option>
                      <option value="stille_verkoop">Stille verkoop</option>
                      <option value="openbaar">Openbaar</option>
                      <option value="via_makelaar">Via makelaar</option>
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
                      placeholder="bv. voorbeeldobject centrum"
                      disabled={!form.anoniem}
                    />
                  </Veld>
                  <Veld label="Publieke regio">
                    <Input
                      value={form.publiekeRegio ?? ''}
                      onChange={e => set('publiekeRegio', e.target.value || undefined)}
                      placeholder="bv. regio"
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
                      value={form.propertyTypeId ?? ''}
                      onChange={e => setPropertyType(e.target.value || undefined)}
                    >
                      <option value="">— Kies type vastgoed —</option>
                      {propertyTypes.map(pt => (
                        <option key={pt.id} value={pt.id}>{pt.name}</option>
                      ))}
                    </select>
                  </Veld>
                  <Veld label="Subcategorieën (optioneel, meerdere mogelijk)" span={2}>
                    {form.propertyTypeId ? (
                      <MultiSelectChips
                        options={subtypesForType(form.propertyTypeId).map(s => ({ value: s.id, label: s.name }))}
                        value={form.propertySubtypeIds ?? []}
                        onChange={v => set('propertySubtypeIds', v)}
                        emptyLabel="Geen subcategorieën beschikbaar voor dit type"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Kies eerst een type vastgoed.</p>
                    )}
                  </Veld>
                  <Veld label="Dealtype / Propositie (meerdere mogelijk)" span={2}>
                    <MultiSelectChips
                      options={dealTypes.map(d => ({ value: d.id, label: d.name }))}
                      value={form.dealTypeIds ?? []}
                      onChange={v => set('dealTypeIds', v)}
                    />
                  </Veld>
                  <Veld label="Beschikbaar vanaf">
                    <Input
                      type="date"
                      value={form.beschikbaarVanaf ?? ''}
                      onChange={e => set('beschikbaarVanaf', e.target.value || undefined)}
                    />
                  </Veld>
                  {/* huidigGebruik verplaatst naar tab Verhuur */}
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
                      placeholder="bv. eigen netwerk, makelaar"
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
                    <NumberField value={form.vraagprijs}
                      onChange={v => set('vraagprijs', v)} placeholder="bv. 1.000.000" />
                  </Veld>
                  <Veld label="Prijsindicatie (tekstueel)">
                    <Input value={form.prijsindicatie ?? ''}
                      onChange={e => set('prijsindicatie', e.target.value || undefined)}
                      placeholder="bv. op aanvraag" />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Huur & rendement">
                {(() => {
                  const m2Basis = form.oppervlakteGbo ?? form.oppervlakteVvo ?? form.oppervlakte;
                  // Huur/m² per jaar = jaarhuur / m². ALTIJD afgeleid van jaarhuur, nooit van maandhuur.
                  const autoHuurPerM2 = calcHuurPerM2(form.huurinkomsten, m2Basis);
                  const autoBar = calcBar(form.huurinkomsten, form.vraagprijs);
                  // Fase 2C-1: geen automatische NAR-afleiding meer op form; NAR blijft handmatig.
                  const autoFactor = calcFactor(form.vraagprijs, form.huurinkomsten);
                  // Wanneer gebruiker niet handmatig invulde: toon afgeleide waarde live in het veld.
                  const huurPerM2Display = huurPerM2Manual
                    ? (form.huurPerM2 ?? '')
                    : (autoHuurPerM2 ?? '');

                  const setJaarhuur = (raw: string) => {
                    const v = num(raw);
                    setLaatstGewijzigdHuur('jaar');
                    set('huurinkomsten', v);
                    setMaandhuurInput(v == null ? '' : String(maandhuurFromJaar(v) ?? ''));
                  };
                  const setMaandhuur = (raw: string) => {
                    setMaandhuurInput(raw);
                    setLaatstGewijzigdHuur('maand');
                    const v = num(raw);
                    const jaar = jaarFromMaandhuur(v);
                    set('huurinkomsten', jaar);
                  };
                  return (
                    <>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <Veld label="Totale huurinkomsten (€/jr)">
                          <NumberField className="min-w-0"
                            value={form.huurinkomsten}
                            onChange={v => { setLaatstGewijzigdHuur('jaar'); set('huurinkomsten', v); setMaandhuurInput(v == null ? '' : String(maandhuurFromJaar(v) ?? '')); }}
                            placeholder="bv. 5.000" />
                          <p className="text-[11px] text-muted-foreground mt-1">Fallback/indicatie. Als huurdersregels aanwezig zijn, wordt de totale huur op detailniveau daarvan afgeleid.</p>
                        </Veld>
                        <Veld label={<>Maandelijkse huur (€/mnd) <AutoBadge show={laatstGewijzigdHuur !== 'maand' && !!form.huurinkomsten} /></>}>
                          <NumberField className="min-w-0"
                            value={maandhuurInput === '' ? undefined : Number(maandhuurInput)}
                            onChange={v => { setMaandhuurInput(v == null ? '' : String(v)); setLaatstGewijzigdHuur('maand'); set('huurinkomsten', jaarFromMaandhuur(v)); }}
                            placeholder="auto = jaarhuur ÷ 12" />
                        </Veld>
                        <Veld label={<>Huur per m² per jaar (€/m²/jr) <AutoBadge show={!huurPerM2Manual && autoHuurPerM2 != null} /><RefMark level="nuttig" show={markeerAlsReferentie} /></>}>
                          <NumberField className="min-w-0"
                            decimals={2}
                            value={huurPerM2Display === '' ? undefined : Number(huurPerM2Display)}
                            onChange={v => {
                              setHuurPerM2Manual(v != null);
                              set('huurPerM2', v);
                            }}
                            placeholder={autoHuurPerM2 != null ? fmtEuroNL(autoHuurPerM2, { decimals: 2 }) : 'onvoldoende gegevens'} />
                          {/* Fase 2C-1: auto/delta-preview alleen bij handmatige override + geldige auto. */}
                          {huurPerM2Manual && form.huurPerM2 != null && autoHuurPerM2 != null && (() => {
                            const delta = form.huurPerM2! - autoHuurPerM2;
                            const tol = Math.max(Math.abs(autoHuurPerM2) * 0.01, 2);
                            const mismatch = Math.abs(delta) > tol;
                            const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
                            const deltaStr = `${sign}€ ${Math.abs(delta).toLocaleString('nl-NL', { maximumFractionDigits: 2 })}/m²`;
                            return (
                              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground" data-testid="huurperm2-delta">
                                <span>auto: {fmtEuroNL(autoHuurPerM2, { decimals: 2, suffix: '/m²' })} · Δ {deltaStr}</span>
                                {mismatch && (
                                  <span
                                    title="Handmatige waarde wijkt af van berekening"
                                    aria-label="Handmatige waarde wijkt af van berekening"
                                    data-testid="huurperm2-mismatch"
                                    className="inline-flex text-amber-600 dark:text-amber-400"
                                  >
                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                  </span>
                                )}
                              </p>
                            );
                          })()}
                        </Veld>
                        <Veld label="Servicekosten (€/jr)">
                          <NumberField className="min-w-0" value={form.servicekostenJaar}
                            onChange={v => set('servicekostenJaar', v)} />
                          <p className="mt-1 text-[11px] text-muted-foreground" data-testid="servicekosten-hint">
                            Servicekosten worden doorgaans doorbelast en tellen niet automatisch mee in NOI/NAR.
                          </p>
                        </Veld>
                        <Veld
                          label={
                            <>
                              NOI — netto operationeel inkomen (€/jr)
                              <span
                                className="ml-1 inline-flex align-middle text-muted-foreground"
                                title="NOI wordt bewust niet automatisch berekend — servicekosten worden doorgaans doorbelast en zijn geen betrouwbare exploitatiekosten. Vul handmatig in."
                                aria-label="Uitleg NOI"
                                data-testid="noi-info"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </span>
                            </>
                          }
                        >
                          <NumberField className="min-w-0" value={form.noi}
                            onChange={v => set('noi', v)}
                            placeholder="bv. 82.000" />
                          <p className="mt-1 text-[11px] text-muted-foreground" data-testid="noi-hint">
                            NOI wordt bewust niet automatisch berekend — servicekosten worden doorgaans doorbelast en zijn geen betrouwbare exploitatiekosten. Vul handmatig in.
                          </p>
                        </Veld>
                        <Veld label={<>BAR — bruto aanvangsrendement (%) <AutoBadge show={form.brutoAanvangsrendement == null && autoBar != null} /></>}>
                          <NumberField className="min-w-0"
                            decimals={2}
                            value={form.brutoAanvangsrendement}
                            onChange={v => set('brutoAanvangsrendement', v)}
                            placeholder={autoBar != null ? fmtPctNL(autoBar) : 'jaarhuur ÷ vraagprijs'} />
                          {form.brutoAanvangsrendement == null && autoBar != null && (
                            <p className="text-[11px] text-muted-foreground mt-1">Auto-berekend: {fmtPctNL(autoBar)}</p>
                          )}
                          {/* Fase 2C-1: auto/delta-preview bij handmatige override op BAR. */}
                          {form.brutoAanvangsrendement != null && autoBar != null && (() => {
                            const delta = form.brutoAanvangsrendement! - autoBar;
                            const mismatch = Math.abs(delta) > 0.2;
                            const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
                            const deltaStr = `${sign}${Math.abs(delta).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
                            return (
                              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground" data-testid="bar-delta">
                                <span>auto: {fmtPctNL(autoBar)} · Δ {deltaStr}</span>
                                {mismatch && (
                                  <AlertTriangle
                                    className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400"
                                    aria-label="Handmatige waarde wijkt af van berekening"
                                    data-testid="bar-mismatch"
                                  >
                                    <title>Handmatige waarde wijkt af van berekening</title>
                                  </AlertTriangle>
                                )}
                              </p>
                            );
                          })()}
                        </Veld>
                        <Veld
                          label={
                            <>
                              NAR — netto aanvangsrendement (%)
                              <span
                                className="ml-1 inline-flex align-middle text-muted-foreground"
                                title="NAR wordt niet automatisch afgeleid — vereist echte verwervings- en exploitatiekosten. Vul handmatig in."
                                aria-label="Uitleg NAR"
                                data-testid="nar-info"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </span>
                            </>
                          }
                        >
                          <NumberField className="min-w-0"
                            decimals={2}
                            value={form.nettoAanvangsrendement}
                            onChange={v => set('nettoAanvangsrendement', v)}
                            placeholder="bv. 5,20" />
                          <p className="mt-1 text-[11px] text-muted-foreground" data-testid="nar-hint">
                            NAR wordt niet automatisch afgeleid — vereist echte verwervings- en exploitatiekosten. Vul handmatig in.
                          </p>
                        </Veld>
                        <Veld label={<>Kapitalisatiefactor <AutoBadge show={autoFactor != null} /></>}>
                          <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-mono-data text-foreground">
                            {formatFactor(autoFactor)}
                          </div>
                        </Veld>
                      </div>
                    </>
                  );
                })()}
              </Sectie>

              <Sectie titel="Waarderingen">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="WOZ-waarde (€)">
                    <NumberField className="min-w-0" value={form.wozWaarde}
                      onChange={v => set('wozWaarde', v)} />
                  </Veld>
                  <Veld label="WOZ-peildatum (jaar)">
                    <NumberField
                      integer
                      min={2000}
                      max={new Date().getFullYear() + 1}
                      className="min-w-0"
                      placeholder="bv. 2025"
                      value={form.wozPeildatum ? new Date(form.wozPeildatum).getFullYear() : undefined}
                      onChange={v => {
                        if (v == null) { set('wozPeildatum', undefined); return; }
                        if (!Number.isFinite(v)) return;
                        set('wozPeildatum', `${Math.trunc(v)}-01-01`);
                      }}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">Wordt opgeslagen als 1 januari van het gekozen jaar.</p>
                  </Veld>
                  <Veld label="Taxatiewaarde (€)">
                    <NumberField className="min-w-0" value={form.taxatiewaarde}
                      onChange={v => set('taxatiewaarde', v)} />
                  </Veld>
                  <Veld label="Taxatiedatum">
                    <Input type="date" className="min-w-0" value={form.taxatiedatum ?? ''}
                      onChange={e => set('taxatiedatum', e.target.value || undefined)} />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Marktwaarde-indicatie">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Marktwaarde-indicatie (€)">
                    <NumberField value={form.marktwaardeIndicatie}
                      onChange={v => set('marktwaardeIndicatie', v)} />
                  </Veld>
                  <Veld label="Bron / toelichting">
                    <Input value={form.marktwaardeBron ?? ''}
                      onChange={e => set('marktwaardeBron', e.target.value || undefined)}
                      placeholder="bv. eigen analyse, mediaan referenties" />
                  </Veld>
                </div>
              </Sectie>
            </TabsContent>


            {/* TAB 3: VERHUUR */}
            <TabsContent value="verhuur" className="space-y-5 mt-0">
              <Sectie titel="Verhuurstatus & gebruik">
                <div className="grid sm:grid-cols-2 gap-4">
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
                  <Veld label="Huidig gebruik">
                    <Input
                      value={form.huidigGebruik ?? ''}
                      onChange={e => set('huidigGebruik', e.target.value || undefined)}
                      placeholder="bv. verhuurd aan huurder"
                    />
                  </Veld>
                  <Veld label="Aantal huurders (fallback)">
                    <NumberField integer value={form.aantalHuurders}
                      onChange={v => set('aantalHuurders', v)}
                      placeholder="Alleen gebruikt als er geen huurdersregels zijn" />
                    <p className="text-[11px] text-muted-foreground mt-1">Als huurdersregels aanwezig zijn, wordt het huurdersaantal op detailniveau daarvan afgeleid.</p>
                  </Veld>
                  <Veld label="Leegstand (%)">
                    <NumberField decimals={1} value={form.leegstandPct}
                      onChange={v => set('leegstandPct', v)} />
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
                    <NumberField decimals={2} value={form.oppervlakte}
                      onChange={v => set('oppervlakte', v)} />
                  </Veld>
                  <Veld label="VVO — verhuurbaar vloeroppervlak (m²)">
                    <NumberField decimals={2} value={form.oppervlakteVvo}
                      onChange={v => set('oppervlakteVvo', v)} />
                  </Veld>
                  <Veld label="BVO — bruto vloeroppervlak (m²)">
                    <NumberField decimals={2} value={form.oppervlakteBvo}
                      onChange={v => set('oppervlakteBvo', v)} />
                  </Veld>
                  <Veld label="GBO — gebruiksoppervlak (m²)">
                    <NumberField decimals={2} value={form.oppervlakteGbo}
                      onChange={v => set('oppervlakteGbo', v)} />
                  </Veld>
                  <Veld label={<>Perceeloppervlak (m²)<RefMark level="nuttig" show={markeerAlsReferentie} /></>}>
                    <NumberField decimals={2} value={form.perceelOppervlakte}
                      onChange={v => set('perceelOppervlakte', v)} />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Bouw">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label={<>Bouwjaar<RefMark level="sterk" show={markeerAlsReferentie} /></>}>
                    <NumberField integer value={form.bouwjaar}
                      onChange={v => set('bouwjaar', v)} />
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
                    <NumberField integer value={form.aantalVerdiepingen}
                      onChange={v => set('aantalVerdiepingen', v)} />
                  </Veld>
                  <Veld label="Aantal units">
                    <NumberField integer value={form.aantalUnits}
                      onChange={v => set('aantalUnits', v)} />
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

              <Sectie titel="Oppervlakten per verdieping">
                <OppervlaktenEditor
                  rijen={form.oppervlaktenPerVerdieping ?? []}
                  onChange={v => set('oppervlaktenPerVerdieping', v)}
                />
              </Sectie>

              <Sectie titel="Technische staat (toelichting)">
                <Veld label="Technische staat / MJOP">
                  <Textarea rows={3} value={form.technischeStaatOmschrijving ?? ''}
                    onChange={e => set('technischeStaatOmschrijving', e.target.value || undefined)}
                    placeholder="Aanvulling op onderhoudsstaat-niveau, MJOP, recente ingrepen" />
                </Veld>
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
            <TabsContent value="contacten" className="space-y-5 mt-0">
              <div className="rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Deze velden zijn bedoeld als vrije tekst/fallback. De gekoppelde relatie blijft leidend waar beschikbaar.
              </div>
              <Sectie titel="Verkoper / eigenaar / aanbieder">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Naam">
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

              <Sectie titel="Objectcontact / makelaar / tussenpersoon">
                <p className="text-xs text-muted-foreground -mt-2">
                  Indien leeg vallen IM en 1-pager terug op de verkoper-info. Lege velden verschijnen niet.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Naam">
                    <Input value={form.contactNaam ?? ''}
                      onChange={e => set('contactNaam', e.target.value || undefined)} />
                  </Veld>
                  <Veld label="Functie">
                    <Input value={form.contactFunctie ?? ''}
                      onChange={e => set('contactFunctie', e.target.value || undefined)} />
                  </Veld>
                  <Veld label="Telefoon">
                    <Input value={form.contactTelefoon ?? ''}
                      onChange={e => set('contactTelefoon', e.target.value || undefined)} />
                  </Veld>
                  <Veld label="E-mail">
                    <Input type="email" value={form.contactEmail ?? ''}
                      onChange={e => set('contactEmail', e.target.value || undefined)} />
                  </Veld>
                </div>
              </Sectie>
            </TabsContent>

            {/* TAB: POTENTIE */}
            <TabsContent value="potentie" className="space-y-5 mt-0">
              <div className="p-3 bg-muted/40 rounded-md flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Registratie van ontwikkel- of transformatiepotentie. Vul alleen in als er werkelijk potentie is.
                  Dit blok is een kansenregistratie — voor doorrekenen gebruik je Vastgoedrekenen.
                </p>
              </div>

              <Sectie titel="Type potentie">
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

              {(form.ontwikkelPotentie || form.transformatiePotentie
                || form.potentieOmschrijving || form.potentieExtraM2 != null
                || form.potentieExtraUnits != null) && (
                <>
                  <Sectie titel="Omschrijving & strategie">
                    <Veld label="Potentieomschrijving">
                      <Textarea rows={2} value={form.potentieOmschrijving ?? ''}
                        onChange={e => set('potentieOmschrijving', e.target.value || undefined)}
                        placeholder="Korte beschrijving van de potentie of mogelijkheid" />
                    </Veld>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Veld label="Mogelijke strategie">
                        <select
                          className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                          value={form.potentieStrategie ?? ''}
                          onChange={e => set('potentieStrategie', e.target.value || undefined)}
                        >
                          <option value="">— Onbekend —</option>
                          <option value="transformatie">Transformatie</option>
                          <option value="uitponden">Uitponden</option>
                          <option value="splitsen">Splitsen</option>
                          <option value="optoppen">Optoppen</option>
                          <option value="herontwikkeling">Herontwikkeling</option>
                          <option value="kamerverhuur">Kamerverhuur</option>
                          <option value="functiewijziging">Functiewijziging</option>
                          <option value="renovatie">Renovatie / value-add</option>
                          <option value="uitbreiding">Uitbreiding</option>
                          <option value="anders">Anders</option>
                        </select>
                      </Veld>
                      <Veld label="Status onderbouwing">
                        <select
                          className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                          value={form.potentieOnderbouwingStatus ?? ''}
                          onChange={e => set('potentieOnderbouwingStatus', e.target.value || undefined)}
                        >
                          <option value="">— Onbekend —</option>
                          <option value="idee">Idee</option>
                          <option value="indicatief">Indicatief</option>
                          <option value="besproken">Besproken</option>
                          <option value="onderzocht">Onderzocht</option>
                          <option value="vergunningstraject">Vergunningstraject</option>
                          <option value="vergund">Vergund</option>
                        </select>
                      </Veld>
                    </div>
                  </Sectie>

                  <Sectie titel="Programma na plan">
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Veld label="Huidige m²">
                        <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-mono-data text-foreground">
                          {(() => {
                            const huidig = form.oppervlakteGbo ?? form.oppervlakteVvo ?? form.oppervlakte;
                            return huidig != null ? `${huidig.toLocaleString('nl-NL')} m²` : '—';
                          })()}
                        </div>
                      </Veld>
                      <Veld label="Extra m² mogelijk">
                        <NumberField decimals={2} className="min-w-0"
                          value={form.potentieExtraM2}
                          onChange={v => set('potentieExtraM2', v)}
                          placeholder="bv. 75,5" />
                      </Veld>
                      <Veld label={<>Totaal m² na plan <AutoBadge /></>}>
                        <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-mono-data text-foreground">
                          {(() => {
                            const huidig = form.oppervlakteGbo ?? form.oppervlakteVvo ?? form.oppervlakte;
                            const extra = form.potentieExtraM2;
                            if ((huidig == null || !Number.isFinite(huidig)) && (extra == null || !Number.isFinite(extra))) return '—';
                            const totaal = (huidig ?? 0) + (extra ?? 0);
                            return Number.isFinite(totaal) ? `${totaal.toLocaleString('nl-NL')} m²` : '—';
                          })()}
                        </div>
                      </Veld>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4 mt-4">
                      <Veld label="Huidige units">
                        <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-mono-data text-foreground">
                          {form.aantalUnits != null ? form.aantalUnits : '—'}
                        </div>
                      </Veld>
                      <Veld label="Extra units mogelijk">
                        <NumberField integer className="min-w-0"
                          value={form.potentieExtraUnits}
                          onChange={v => set('potentieExtraUnits', v == null ? undefined : Math.trunc(v))}
                          placeholder="bv. 3" />
                      </Veld>
                      <Veld label={<>Totaal units na plan <AutoBadge /></>}>
                        <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-mono-data text-foreground">
                          {(() => {
                            const huidig = form.aantalUnits;
                            const extra = form.potentieExtraUnits;
                            if ((huidig == null || !Number.isFinite(huidig)) && (extra == null || !Number.isFinite(extra))) return '—';
                            const totaal = (huidig ?? 0) + (extra ?? 0);
                            return Number.isFinite(totaal) ? String(totaal) : '—';
                          })()}
                        </div>
                      </Veld>
                    </div>
                  </Sectie>

                  <Sectie titel="Onderbouwing & risico's">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Veld label="Bron / onderbouwing">
                        <select
                          className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                          value={form.potentieBron ?? ''}
                          onChange={e => set('potentieBron', e.target.value || undefined)}
                        >
                          <option value="">— Onbekend —</option>
                          <option value="gemeente">Gemeente</option>
                          <option value="makelaar">Makelaar</option>
                          <option value="architect">Architect</option>
                          <option value="eigenaar">Eigenaar</option>
                          <option value="eigen_analyse">Eigen analyse</option>
                          <option value="onbekend">Onbekend</option>
                        </select>
                      </Veld>
                    </div>
                    <Veld label="Belangrijkste afhankelijkheden / risico's">
                      <Textarea rows={2} value={form.potentieAfhankelijkheden ?? ''}
                        onChange={e => set('potentieAfhankelijkheden', e.target.value || undefined)}
                        placeholder="bv. bestemmingsplanwijziging, parkeernorm, draagvlak gemeente" />
                    </Veld>
                  </Sectie>
                </>
              )}
            </TabsContent>

            {/* TAB: AANBIEDING & DOSSIER */}
            <TabsContent value="aanbieding" className="space-y-5 mt-0">
              <div className="p-3 bg-muted/40 rounded-md flex items-start gap-2">
                <FileSignature className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Commerciële- en dossier-laag: samenvatting, propositie, omschrijvingen, proces en IM/1-pager-zichtbaarheid.
                  Lege velden worden automatisch verborgen.
                </p>
              </div>

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

              <Sectie titel="Propositie & omschrijvingen">
                <Veld label="Propositie (kernboodschap)">
                  <Textarea rows={3} value={form.propositie ?? ''}
                    onChange={e => set('propositie', e.target.value || undefined)}
                    placeholder="Eén-alinea kernboodschap voor de cover van IM en 1-pager" />
                </Veld>
                <Veld label="Objectomschrijving">
                  <Textarea rows={4} value={form.objectomschrijving ?? ''}
                    onChange={e => set('objectomschrijving', e.target.value || undefined)}
                    placeholder="Inhoudelijke beschrijving van het pand, indeling, gebruik" />
                </Veld>
                <Veld label="Locatie-omschrijving">
                  <Textarea rows={3} value={form.locatieOmschrijving ?? ''}
                    onChange={e => set('locatieOmschrijving', e.target.value || undefined)}
                    placeholder="Bereikbaarheid, omgeving, voorzieningen, demografie" />
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

              <Sectie titel="Proces & dataroom">
                <Veld label="Proces & voorwaarden">
                  <Textarea rows={3} value={form.procesVoorwaarden ?? ''}
                    onChange={e => set('procesVoorwaarden', e.target.value || undefined)}
                    placeholder="bv. gesloten biedprocedure, deadline, NDA verplicht" />
                </Veld>
                <Veld label="Dataroom-URL">
                  <Input type="url" value={form.dataroomUrl ?? ''}
                    onChange={e => set('dataroomUrl', e.target.value || undefined)}
                    placeholder="https://..." />
                </Veld>
              </Sectie>

              <Sectie titel="Documentatie-overzicht (in IM)">
                <p className="text-xs text-muted-foreground -mt-2">
                  Per documenttype kun je de status kiezen. Alleen typen met een gekozen status verschijnen in de documentatietabel van het IM. Voor het werkelijke dossier en readiness, zie Dossier & aanbieding op de objectpagina.
                </p>
                <DocumentatieStatusEditor
                  status={form.documentatieStatus ?? {}}
                  onChange={v => set('documentatieStatus', v)}
                />
              </Sectie>

              <Sectie titel="IM-secties zichtbaar">
                <p className="text-xs text-muted-foreground -mt-2">
                  Default: een sectie verschijnt automatisch als er content voor is. Hier kun je individuele secties expliciet uitzetten.
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {IM_SECTIES.map(s => {
                    const huidig = form.imSectiesZichtbaar?.[s.key];
                    const aan = huidig !== false;
                    return (
                      <label key={s.key} className="flex items-center justify-between gap-2 p-2 rounded-md border border-border hover:bg-muted/30">
                        <span className="text-sm">{s.label}</span>
                        <Switch
                          checked={aan}
                          onCheckedChange={(v) => {
                            const next = { ...(form.imSectiesZichtbaar ?? {}) };
                            if (v) delete next[s.key]; else next[s.key] = false;
                            set('imSectiesZichtbaar', next);
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </Sectie>

              {(form.financieleScenarios?.huidig || form.financieleScenarios?.marktconform || form.financieleScenarios?.naRenovatie) && (
                <Sectie titel="Financiële scenario's (legacy snapshot)">
                  <p className="text-xs text-muted-foreground -mt-2">
                    Bestaande scenario's blijven beschikbaar. Voor doorrekenen en vergelijking: gebruik Vastgoedrekenen.
                  </p>
                  <ScenarioBlok
                    titel="Huidige situatie"
                    scenario={form.financieleScenarios?.huidig}
                    onChange={s => set('financieleScenarios', { ...(form.financieleScenarios ?? {}), huidig: s })}
                  />
                  <ScenarioBlok
                    titel="Marktconform"
                    scenario={form.financieleScenarios?.marktconform}
                    onChange={s => set('financieleScenarios', { ...(form.financieleScenarios ?? {}), marktconform: s })}
                  />
                  <ScenarioBlok
                    titel="Na renovatie / herontwikkeling"
                    scenario={form.financieleScenarios?.naRenovatie}
                    onChange={s => set('financieleScenarios', { ...(form.financieleScenarios ?? {}), naRenovatie: s })}
                  />
                </Sectie>
              )}
            </TabsContent>

            {/* TAB 9: MEDIA */}
            <TabsContent value="media" className="space-y-6 mt-0">
              {objectId ? (
                <>
                  <Sectie titel="Foto's">
                    <p className="text-xs text-muted-foreground -mt-2 mb-3">Upload objectfoto's voor de detailpagina, teaser en PDF.</p>
                    <FotosPanel objectId={objectId} />
                  </Sectie>
                  <Sectie titel="Plattegronden">
                    <p className="text-xs text-muted-foreground -mt-2 mb-3">Upload plattegronden, meetstaten of indelingsschetsen. Worden apart van gewone foto's bewaard.</p>
                    <DocumentenPanel
                      objectId={objectId}
                      filterTypes={['plattegrond']}
                      defaultType="plattegrond"
                      hideTypeSelector
                      acceptAttr="application/pdf,image/*"
                      helpText={`PDF, JPG, PNG, WEBP · max ${25} MB per bestand`}
                      emptyText="Nog geen plattegronden geüpload."
                    />
                  </Sectie>
                  <Sectie titel="Documenten">
                    <p className="text-xs text-muted-foreground -mt-2 mb-3">Upload verkoopdocumentatie, huurinformatie, juridische stukken en overige onderbouwing.</p>
                    <DocumentenPanel
                      objectId={objectId}
                      excludeTypes={['plattegrond']}
                    />
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
      <ArchiveerDialog
        open={archiefOpen}
        onOpenChange={setArchiefOpen}
        kind="object"
        defaultReason={defaultReasonVoorStatus(form.status)}
        showSkip
        triggerHint={`Status wijzigt naar "${form.status === 'verkocht' ? 'Verkocht' : form.status === 'ingetrokken' ? 'Ingetrokken' : 'Afgevallen'}". Archiveer direct mee, of bewaar alleen de status.`}
        onConfirm={async ({ reason, note }) => {
          setArchiefOpen(false);
          await persist({
            isArchived: true,
            archivedAt: new Date().toISOString(),
            archivedReason: reason,
            archivedNote: note,
          }, 'Object gearchiveerd en verplaatst naar Archief.');
        }}
        onSkip={() => {
          // Save status zonder archiveren — overschrijf auto-archief in store
          persist({ isArchived: false, archivedAt: undefined, archivedReason: undefined, archivedNote: undefined });
        }}
      />
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
/** Kleine `auto`-indicator naast afgeleide velden. */
function AutoBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-1.5 align-middle inline-flex items-center rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent">
      auto
    </span>
  );
}

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

// ---------------------------------------------------------------------
// IM-tab editors
// ---------------------------------------------------------------------

type OppRij = { verdieping: string; vvo?: number; bvo?: number; bestemming?: string };

function OppervlaktenEditor({
  rijen, onChange,
}: { rijen: OppRij[]; onChange: (v: OppRij[]) => void }) {
  const updateRij = (i: number, patch: Partial<OppRij>) => {
    const next = rijen.map((r, idx) => idx === i ? { ...r, ...patch } : r);
    onChange(next);
  };
  const verwijder = (i: number) => onChange(rijen.filter((_, idx) => idx !== i));
  const toevoegen = () => onChange([...rijen, { verdieping: '' }]);

  return (
    <div className="space-y-2">
      {rijen.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Nog geen verdiepingen toegevoegd.
        </p>
      )}
      {rijen.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-12 sm:col-span-3">
            <Label className="text-xs">Verdieping</Label>
            <Input value={r.verdieping}
              onChange={e => updateRij(i, { verdieping: e.target.value })}
              placeholder="bv. BG, 1e" />
          </div>
          <div className="col-span-4 sm:col-span-2">
            <Label className="text-xs">VVO m²</Label>
            <NumberField decimals={2} value={r.vvo}
              onChange={v => updateRij(i, { vvo: v })} />
          </div>
          <div className="col-span-4 sm:col-span-2">
            <Label className="text-xs">BVO m²</Label>
            <NumberField decimals={2} value={r.bvo}
              onChange={v => updateRij(i, { bvo: v })} />
          </div>
          <div className="col-span-4 sm:col-span-4">
            <Label className="text-xs">Bestemming / gebruik</Label>
            <Input value={r.bestemming ?? ''}
              onChange={e => updateRij(i, { bestemming: e.target.value || undefined })}
              placeholder="bv. retail, kantoor" />
          </div>
          <div className="col-span-12 sm:col-span-1 flex justify-end">
            <Button type="button" variant="ghost" size="icon" onClick={() => verwijder(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={toevoegen}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Verdieping toevoegen
      </Button>
    </div>
  );
}

type ScenarioWaarde = { jaarhuur?: number; bar?: number; noi?: number; opmerking?: string };

function ScenarioBlok({
  titel, scenario, onChange,
}: { titel: string; scenario?: ScenarioWaarde; onChange: (v: ScenarioWaarde | undefined) => void }) {
  const s = scenario ?? {};
  const update = (patch: Partial<ScenarioWaarde>) => {
    const next = { ...s, ...patch };
    // Als alle velden leeg zijn → undefined zodat sectie weg blijft uit IM
    const leeg = !next.jaarhuur && !next.bar && !next.noi && !next.opmerking?.trim();
    onChange(leeg ? undefined : next);
  };
  return (
    <div className="border border-border rounded-md p-3 space-y-2 bg-muted/20">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{titel}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Jaarhuur (€)</Label>
          <NumberField value={s.jaarhuur}
            onChange={v => update({ jaarhuur: v })} />
        </div>
        <div>
          <Label className="text-xs">BAR (%)</Label>
          <NumberField decimals={2} value={s.bar}
            onChange={v => update({ bar: v })} />
        </div>
        <div>
          <Label className="text-xs">NOI (€/jr)</Label>
          <NumberField value={s.noi}
            onChange={v => update({ noi: v })} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Toelichting</Label>
        <Input value={s.opmerking ?? ''}
          onChange={e => update({ opmerking: e.target.value || undefined })}
          placeholder="optionele toelichting" />
      </div>
    </div>
  );
}

type DocStatus = 'beschikbaar' | 'op_aanvraag' | 'na_nda';

function DocumentatieStatusEditor({
  status, onChange,
}: { status: Record<string, DocStatus>; onChange: (v: Record<string, DocStatus>) => void }) {
  const setStatus = (type: DocumentType, val: '' | DocStatus) => {
    const next = { ...status };
    if (val === '') delete next[type]; else next[type] = val;
    onChange(next);
  };
  return (
    <div className="space-y-1">
      {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => {
        const huidig = status[key] ?? '';
        return (
          <div key={key} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
            <span className="text-sm">{label}</span>
            <select
              value={huidig}
              onChange={e => setStatus(key as DocumentType, e.target.value as '' | DocStatus)}
              className="h-9 px-2 text-xs rounded-md border border-input bg-background min-w-[160px]"
            >
              <option value="">— Niet tonen —</option>
              <option value="beschikbaar">Beschikbaar</option>
              <option value="op_aanvraag">Op aanvraag</option>
              <option value="na_nda">Na NDA</option>
            </select>
          </div>
        );
      })}
    </div>
  );
}
