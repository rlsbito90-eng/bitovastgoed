// src/components/forms/RelatieFormDialog.tsx
//
// Batch 11: Contact-tab is verwijderd. De inhoud is herverdeeld:
//   - Eén primaire contactpersoon-invoer komt nu in tab Algemeen, BOVEN
//     de bedrijfsgegevens. Bij opslaan wordt deze automatisch als primaire
//     contactpersoon aangemaakt in relatie_contactpersonen.
//   - Communicatievoorkeuren + NDA verhuizen naar tab Investeerder.
//   - Voor bestaande relaties met meerdere contactpersonen: gebruik de
//     detail-pagina (ContactpersonenPanel) — niet meer in deze dialog.
//   - Oude losse "Directe contactgegevens (fallback)" sectie is alleen
//     zichtbaar als er al data in zit (legacy data niet kwijtraken).
//
// Tabs:
//   1. Algemeen     — contactpersoon, bedrijfsgegevens, KVK & adres
//   2. Vastgoed     — propertytypes/subtypes/dealtypes
//   3. Investeerder — budget, kapitaal, dealstructuur + comm.voorkeur + NDA
//   4. Notities     — aankoop/verkoop, opvolging

import { useState, useEffect, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDataStore } from '@/hooks/useDataStore';
import {
  ASSET_CLASS_LABELS,
  INVESTEERDER_SUBTYPE_LABELS,
  KAPITAAL_SITUATIE_LABELS,
  COMMUNICATIE_KANAAL_LABELS,
  REGIO_OPTIES,
} from '@/data/mock-data';
import type {
  Relatie, LeadStatus, PartijType, AssetClass,
  InvesteerderSubtype, KapitaalSituatie, CommunicatieKanaal,
  Dealstructuur,
} from '@/data/mock-data';
import { toast } from 'sonner';
import MultiSelectChips from '@/components/object/MultiSelectChips';
import { Building2, UserCircle2, Info } from 'lucide-react';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatie?: Relatie | null;
}

type FormState = Omit<Relatie, 'id' | 'laatsteContact' | 'softDeletedAt' | 'contactpersoon'>;

// Velden voor de primaire contactpersoon-input (NIEUW in batch 11)
interface PrimaireContactpersoonInput {
  naam: string;
  functie: string;
  email: string;
  telefoon: string;
  telefoonMobiel: string;
}

const leegPrimaireContactpersoon: PrimaireContactpersoonInput = {
  naam: '',
  functie: '',
  email: '',
  telefoon: '',
  telefoonMobiel: '',
};

const DEALSTRUCTUUR_LABELS: Record<Dealstructuur, string> = {
  direct: 'Direct eigendom',
  jv: 'Joint venture',
  fonds: 'Fonds',
  asset_deal: 'Asset deal',
  share_deal: 'Share deal',
};

const leegForm: FormState = {
  bedrijfsnaam: '',
  type: 'belegger',
  investeerderSubtype: undefined,
  telefoon: '',
  email: '',
  website: undefined,
  linkedinUrl: undefined,
  kvkNummer: undefined,
  vestigingsadres: undefined,
  vestigingspostcode: undefined,
  vestigingsplaats: undefined,
  vestigingsland: 'NL',
  regio: [],
  assetClasses: [],
  propertyTypeIds: [],
  propertySubtypeIds: [],
  dealTypeIds: [],
  budgetMin: undefined,
  budgetMax: undefined,
  rendementseis: undefined,
  kapitaalsituatie: 'onbekend',
  eigenVermogenPct: undefined,
  voorkeurDealstructuur: [],
  voorkeurKanaal: undefined,
  voorkeurTaal: 'nl',
  aankoopcriteria: undefined,
  verkoopintentie: undefined,
  ndaGetekend: false,
  ndaDatum: undefined,
  bronRelatie: undefined,
  leadStatus: 'lauw',
  volgendeActie: undefined,
  notities: undefined,
};


export default function RelatieFormDialog({ open, onOpenChange, relatie }: Props) {
  const store = useDataStore();
  const { addRelatie, updateRelatie } = store;
  const { propertyTypes, dealTypes, subtypesForTypes } = usePropertyTaxonomie();
  const isEdit = !!relatie;
  const [gemaaktId, setGemaaktId] = useState<string | undefined>(relatie?.id);
  const relatieId = relatie?.id ?? gemaaktId;

  const [form, setForm] = useState<FormState>(leegForm);
  const [contactpersoonInput, setContactpersoonInput] =
    useState<PrimaireContactpersoonInput>(leegPrimaireContactpersoon);
  const [primaireContactpersoonId, setPrimaireContactpersoonId] = useState<string | undefined>();
  const [bezig, setBezig] = useState(false);
  const [tab, setTab] = useState('algemeen');

  // Hydreer form bij open. Pre-fill ook de primaire contactpersoon-input
  // vanuit relatie_contactpersonen (waar is_primair = true).
  useEffect(() => {
    if (relatie) {
      const { id, laatsteContact, softDeletedAt, contactpersoon, ...rest } = relatie;
      setForm({ ...leegForm, ...rest });
      setGemaaktId(relatie.id);

      // Zoek de primaire contactpersoon in de store
      const primair = store.contactpersonen?.find(
        c => c.relatieId === relatie.id && c.isPrimair,
      );
      if (primair) {
        setContactpersoonInput({
          naam: primair.naam ?? '',
          functie: primair.functie ?? '',
          email: primair.email ?? '',
          telefoon: primair.telefoon ?? '',
          telefoonMobiel: (primair as any).telefoonMobiel ?? '',
        });
        setPrimaireContactpersoonId(primair.id);
      } else {
        setContactpersoonInput(leegPrimaireContactpersoon);
        setPrimaireContactpersoonId(undefined);
      }
    } else {
      setForm(leegForm);
      setContactpersoonInput(leegPrimaireContactpersoon);
      setPrimaireContactpersoonId(undefined);
      setGemaaktId(undefined);
    }
    setTab('algemeen');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatie?.id, open]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const setCp = <K extends keyof PrimaireContactpersoonInput>(
    k: K, v: PrimaireContactpersoonInput[K],
  ) => setContactpersoonInput(prev => ({ ...prev, [k]: v }));

  const num = (v: string) => v === '' ? undefined : Number(v);

  // Detecteer of deze relatie nog "legacy" telefoon/email-velden gebruikt
  // (oude data zonder contactpersonen-tabel). Alleen dan tonen we het oude
  // contactgegevens-blok.
  const heeftLegacyContactdata = !!(
    form.telefoon?.trim() || form.email?.trim()
  );

  const handleSave = async () => {
    if (bezig) return;

    const cpNaam = contactpersoonInput.naam?.trim();
    const heeftBedrijfsnaam = form.bedrijfsnaam?.trim();
    const heeftCpInForm = !!cpNaam;
    const heeftAndereContactpersonen = relatieId
      ? store.contactpersonen?.some(c => c.relatieId === relatieId && c.id !== primaireContactpersoonId)
      : false;

    // Waarschuwing als helemaal niets is ingevuld
    if (!heeftBedrijfsnaam && !heeftCpInForm && !heeftAndereContactpersonen) {
      const bevestig = window.confirm(
        'Deze relatie heeft geen bedrijfsnaam en geen contactpersoon ingevuld. ' +
        'Hij wordt opgeslagen als "(naamloze relatie)". Toch opslaan?'
      );
      if (!bevestig) return;
    }

    setBezig(true);

    const data = { ...form, bedrijfsnaam: form.bedrijfsnaam.trim() };

    try {
      // 1. Relatie opslaan / updaten
      let werkRelatieId = relatieId;
      if (isEdit && relatie) {
        await updateRelatie(relatie.id, data);
      } else if (gemaaktId) {
        await updateRelatie(gemaaktId, data);
      } else {
        const nieuw = await addRelatie({
          ...data,
          laatsteContact: new Date().toISOString().split('T')[0],
          contactpersoon: '', // legacy veld; nieuwe structuur via contactpersonen-tabel
        } as Omit<Relatie, 'id'>);
        if (nieuw?.id) {
          werkRelatieId = nieuw.id;
          setGemaaktId(nieuw.id);
        }
      }

      // 2. Primaire contactpersoon opslaan / updaten / verwijderen
      if (werkRelatieId) {
        const cpData = {
          naam: cpNaam,
          functie: contactpersoonInput.functie?.trim() || undefined,
          email: contactpersoonInput.email?.trim() || undefined,
          telefoon: contactpersoonInput.telefoon?.trim() || undefined,
          telefoonMobiel: contactpersoonInput.telefoonMobiel?.trim() || undefined,
          isPrimair: true,
        };

        if (cpNaam && primaireContactpersoonId) {
          // Update bestaande primaire
          await store.updateContactpersoon?.(primaireContactpersoonId, cpData);
        } else if (cpNaam && !primaireContactpersoonId) {
          // Nieuwe primaire aanmaken
          const nieuweCp = await store.addContactpersoon?.({
            relatieId: werkRelatieId,
            ...cpData,
          });
          if (nieuweCp?.id) setPrimaireContactpersoonId(nieuweCp.id);
        } else if (!cpNaam && primaireContactpersoonId) {
          // Naam is leeg gemaakt → primaire contactpersoon verwijderen
          await store.deleteContactpersoon?.(primaireContactpersoonId);
          setPrimaireContactpersoonId(undefined);
        }
      }

      toast.success(isEdit || gemaaktId ? 'Relatie bijgewerkt' : 'Relatie aangemaakt');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Opslaan mislukt');
    } finally {
      setBezig(false);
    }
  };

  const assetOptions = Object.entries(ASSET_CLASS_LABELS).map(([value, label]) => ({ value, label }));
  const regioOptions = REGIO_OPTIES.map(r => ({ value: r, label: r }));
  const dealstructuurOptions = Object.entries(DEALSTRUCTUUR_LABELS).map(([value, label]) => ({ value, label }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b border-border">
          <DialogTitle>
            {isEdit ? 'Relatie bewerken' : (gemaaktId ? 'Relatie bewerken' : 'Nieuwe relatie')}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-6 pt-3 border-b border-border overflow-x-auto bg-background">
            <TabsList className="inline-flex">
              <TabsTrigger value="algemeen">Algemeen</TabsTrigger>
              <TabsTrigger value="vastgoed">
                <span className="hidden sm:inline">Vastgoed</span>
                <Building2 className="h-4 w-4 sm:hidden" />
              </TabsTrigger>
              <TabsTrigger value="investeerder">Investeerder</TabsTrigger>
              <TabsTrigger value="notities">Notities</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {/* ALGEMEEN — nieuwe volgorde: Contactpersoon → Bedrijf → KVK */}
            <TabsContent value="algemeen" className="space-y-5 mt-0">

              {/* === CONTACTPERSOON (PRIMAIR) === */}
              <Sectie titel="Contactpersoon" icon={UserCircle2}>
                <div className="p-3 bg-accent/5 border border-accent/20 rounded-md flex items-start gap-2 mb-3">
                  <Info className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    De primaire contactpersoon wordt bovenaan getoond in lijsten en details.
                    {relatieId && (
                      <> Extra contactpersonen voeg je toe via de detailpagina van deze relatie.</>
                    )}
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Naam" span={2}>
                    <Input
                      value={contactpersoonInput.naam}
                      onChange={e => setCp('naam', e.target.value)}
                      placeholder="bv. Léon van den Heuvel"
                    />
                  </Veld>
                  <Veld label="Functie">
                    <Input
                      value={contactpersoonInput.functie}
                      onChange={e => setCp('functie', e.target.value)}
                      placeholder="bv. Investment Manager"
                    />
                  </Veld>
                  <Veld label="E-mail">
                    <Input
                      type="email"
                      value={contactpersoonInput.email}
                      onChange={e => setCp('email', e.target.value)}
                      placeholder="naam@bedrijf.nl"
                    />
                  </Veld>
                  <Veld label="Telefoon (vast)">
                    <Input
                      value={contactpersoonInput.telefoon}
                      onChange={e => setCp('telefoon', e.target.value)}
                      placeholder="020 1234567"
                    />
                  </Veld>
                  <Veld label="Telefoon (mobiel)">
                    <Input
                      value={contactpersoonInput.telefoonMobiel}
                      onChange={e => setCp('telefoonMobiel', e.target.value)}
                      placeholder="06 12345678"
                    />
                  </Veld>
                </div>
              </Sectie>

              {/* === BEDRIJFSGEGEVENS === */}
              <Sectie titel="Bedrijfsgegevens">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Bedrijfsnaam" span={2}>
                    <Input
                      value={form.bedrijfsnaam}
                      onChange={e => set('bedrijfsnaam', e.target.value)}
                      placeholder="Bijv. GARBE — laat leeg als de relatie geen bedrijf is"
                    />
                  </Veld>
                  <Veld label="Type partij">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.type}
                      onChange={e => set('type', e.target.value as PartijType)}
                    >
                      <option value="belegger">Belegger</option>
                      <option value="ontwikkelaar">Ontwikkelaar</option>
                      <option value="eigenaar">Eigenaar</option>
                      <option value="makelaar">Makelaar</option>
                      <option value="partner">Partner</option>
                      <option value="overig">Overig</option>
                    </select>
                  </Veld>
                  <Veld label="Subtype">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.investeerderSubtype ?? ''}
                      onChange={e => set('investeerderSubtype', (e.target.value || undefined) as InvesteerderSubtype | undefined)}
                    >
                      <option value="">— Kies subtype —</option>
                      {Object.entries(INVESTEERDER_SUBTYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Veld>
                  <Veld label="Leadstatus">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.leadStatus}
                      onChange={e => set('leadStatus', e.target.value as LeadStatus)}
                    >
                      <option value="koud">Koud</option>
                      <option value="lauw">Lauw</option>
                      <option value="warm">Warm</option>
                      <option value="actief">Actief</option>
                    </select>
                  </Veld>
                  <Veld label="Bron relatie">
                    <Input value={form.bronRelatie ?? ''} onChange={e => set('bronRelatie', e.target.value || undefined)}
                      placeholder="bv. event X, intro door Y" />
                  </Veld>
                </div>
              </Sectie>

              {/* === KVK & VESTIGINGSADRES === */}
              <Sectie titel="KVK & vestigingsadres">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="KVK-nummer">
                    <Input value={form.kvkNummer ?? ''} onChange={e => set('kvkNummer', e.target.value || undefined)} />
                  </Veld>
                  <Veld label="Website">
                    <Input value={form.website ?? ''} onChange={e => set('website', e.target.value || undefined)}
                      placeholder="https://..." />
                  </Veld>
                  <Veld label="Vestigingsadres" span={2}>
                    <Input value={form.vestigingsadres ?? ''} onChange={e => set('vestigingsadres', e.target.value || undefined)} />
                  </Veld>
                  <Veld label="Postcode">
                    <Input value={form.vestigingspostcode ?? ''} onChange={e => set('vestigingspostcode', e.target.value || undefined)} />
                  </Veld>
                  <Veld label="Plaats">
                    <Input value={form.vestigingsplaats ?? ''} onChange={e => set('vestigingsplaats', e.target.value || undefined)} />
                  </Veld>
                  <Veld label="Land">
                    <Input value={form.vestigingsland ?? 'NL'} onChange={e => set('vestigingsland', e.target.value || 'NL')} />
                  </Veld>
                  <Veld label="LinkedIn URL">
                    <Input value={form.linkedinUrl ?? ''} onChange={e => set('linkedinUrl', e.target.value || undefined)}
                      placeholder="https://linkedin.com/company/..." />
                  </Veld>
                </div>
              </Sectie>

              {/* === LEGACY CONTACTGEGEVENS === alleen tonen als al gevuld */}
              {heeftLegacyContactdata && (
                <Sectie titel="Algemene contactgegevens (legacy)">
                  <div className="p-3 bg-muted/40 rounded-md flex items-start gap-2 mb-3">
                    <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Deze velden zijn van een eerdere versie. Voor nieuwe relaties gebruik je de
                      Contactpersoon-sectie hierboven. Maak deze velden leeg om ze te verbergen.
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Veld label="Telefoon (algemeen)">
                      <Input value={form.telefoon} onChange={e => set('telefoon', e.target.value)} />
                    </Veld>
                    <Veld label="E-mail (algemeen)">
                      <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
                    </Veld>
                  </div>
                </Sectie>
              )}
            </TabsContent>

            {/* VASTGOED — onveranderd */}
            <TabsContent value="vastgoed" className="space-y-5 mt-0">
              <Sectie titel="Type vastgoed (multi-select)">
                <MultiSelectChips
                  options={propertyTypes.map(t => ({ value: t.id, label: t.name }))}
                  value={form.propertyTypeIds ?? []}
                  onChange={v => {
                    const geldigeSubs = subtypesForTypes(v).map(s => s.id);
                    setForm(prev => ({
                      ...prev,
                      propertyTypeIds: v,
                      propertySubtypeIds: (prev.propertySubtypeIds ?? []).filter(id => geldigeSubs.includes(id)),
                    }));
                  }}
                  emptyLabel="Geen typen geconfigureerd"
                />
              </Sectie>

              <Sectie titel="Subcategorieën">
                {(form.propertyTypeIds ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Kies eerst één of meer typen vastgoed.
                  </p>
                ) : (
                  <MultiSelectChips
                    options={subtypesForTypes(form.propertyTypeIds ?? []).map(s => ({ value: s.id, label: s.name }))}
                    value={form.propertySubtypeIds ?? []}
                    onChange={v => set('propertySubtypeIds', v)}
                    emptyLabel="Geen subcategorieën beschikbaar voor de gekozen typen"
                  />
                )}
              </Sectie>

              <Sectie titel="Dealtype / Propositie">
                <MultiSelectChips
                  options={dealTypes.map(d => ({ value: d.id, label: d.name }))}
                  value={form.dealTypeIds ?? []}
                  onChange={v => set('dealTypeIds', v)}
                  emptyLabel="Geen dealtypes geconfigureerd"
                />
              </Sectie>
            </TabsContent>

            {/* INVESTEERDER — uitgebreid met communicatie + NDA (was Contact-tab) */}
            <TabsContent value="investeerder" className="space-y-5 mt-0">
              <Sectie titel="Asset classes van interesse (legacy)">
                <MultiSelectChips
                  options={assetOptions}
                  value={form.assetClasses}
                  onChange={v => set('assetClasses', v as AssetClass[])}
                />
              </Sectie>

              <Sectie titel="Regio's van interesse">
                <MultiSelectChips
                  options={regioOptions}
                  value={form.regio}
                  onChange={v => set('regio', v)}
                />
              </Sectie>

              <Sectie titel="Budget & rendement">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Budget minimum (€)">
                    <Input type="number" value={form.budgetMin ?? ''}
                      onChange={e => set('budgetMin', num(e.target.value))} />
                  </Veld>
                  <Veld label="Budget maximum (€)">
                    <Input type="number" value={form.budgetMax ?? ''}
                      onChange={e => set('budgetMax', num(e.target.value))} />
                  </Veld>
                  <Veld label="Rendementseis (%)">
                    <Input type="number" step="0.01" value={form.rendementseis ?? ''}
                      onChange={e => set('rendementseis', num(e.target.value))}
                      placeholder="bv. 6.5" />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Kapitaalsituatie">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Situatie">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.kapitaalsituatie ?? 'onbekend'}
                      onChange={e => set('kapitaalsituatie', e.target.value as KapitaalSituatie)}
                    >
                      {Object.entries(KAPITAAL_SITUATIE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Veld>
                  <Veld label="Eigen vermogen (%)">
                    <Input type="number" step="1" min="0" max="100" value={form.eigenVermogenPct ?? ''}
                      onChange={e => set('eigenVermogenPct', num(e.target.value))}
                      placeholder="bv. 30" />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Voorkeur dealstructuur">
                <MultiSelectChips
                  options={dealstructuurOptions}
                  value={form.voorkeurDealstructuur ?? []}
                  onChange={v => set('voorkeurDealstructuur', v as Dealstructuur[])}
                />
              </Sectie>

              {/* NIEUW: communicatievoorkeuren (was tab Contact) */}
              <Sectie titel="Communicatievoorkeuren">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Voorkeur kanaal">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.voorkeurKanaal ?? ''}
                      onChange={e => set('voorkeurKanaal', (e.target.value || undefined) as CommunicatieKanaal | undefined)}
                    >
                      <option value="">— Geen voorkeur —</option>
                      {Object.entries(COMMUNICATIE_KANAAL_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Veld>
                  <Veld label="Voorkeurstaal">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.voorkeurTaal ?? 'nl'}
                      onChange={e => set('voorkeurTaal', e.target.value || 'nl')}
                    >
                      <option value="nl">Nederlands</option>
                      <option value="en">Engels</option>
                      <option value="de">Duits</option>
                      <option value="fr">Frans</option>
                    </select>
                  </Veld>
                </div>
              </Sectie>

              {/* NIEUW: NDA-status (was tab Contact) */}
              <Sectie titel="NDA-status">
                <div className="grid sm:grid-cols-2 gap-4 items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.ndaGetekend}
                      onCheckedChange={v => set('ndaGetekend', !!v)}
                    />
                    NDA is getekend
                  </label>
                  {form.ndaGetekend && (
                    <Veld label="Datum tekening">
                      <Input type="date" value={form.ndaDatum ?? ''}
                        onChange={e => set('ndaDatum', e.target.value || undefined)} />
                    </Veld>
                  )}
                </div>
              </Sectie>
            </TabsContent>

            {/* NOTITIES */}
            <TabsContent value="notities" className="space-y-5 mt-0">
              <Sectie titel="Aankoop & verkoop">
                <Veld label="Aankoopcriteria">
                  <Textarea rows={3} value={form.aankoopcriteria ?? ''}
                    onChange={e => set('aankoopcriteria', e.target.value || undefined)}
                    placeholder="Wat zoekt deze partij concreet?" />
                </Veld>
                <Veld label="Verkoopintentie">
                  <Textarea rows={2} value={form.verkoopintentie ?? ''}
                    onChange={e => set('verkoopintentie', e.target.value || undefined)}
                    placeholder="Wil deze partij (mogelijk) iets verkopen?" />
                </Veld>
              </Sectie>

              <Sectie titel="Opvolging">
                <Veld label="Volgende actie">
                  <Input value={form.volgendeActie ?? ''}
                    onChange={e => set('volgendeActie', e.target.value || undefined)}
                    placeholder="bv. Bellen over pijplijn Q2" />
                </Veld>
                <Veld label="Interne notities">
                  <Textarea rows={4} value={form.notities ?? ''}
                    onChange={e => set('notities', e.target.value || undefined)} />
                </Veld>
              </Sectie>
            </TabsContent>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border px-6 py-3 flex justify-end items-center gap-2 bg-background">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {(isEdit || gemaaktId) ? 'Sluiten' : 'Annuleren'}
            </Button>
            <Button onClick={handleSave} disabled={bezig}>
              {bezig ? 'Bezig…' : (isEdit || gemaaktId ? 'Opslaan' : 'Aanmaken')}
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}


function Sectie({
  titel,
  children,
  icon: Icon,
}: {
  titel: string;
  children: ReactNode;
  icon?: typeof Info;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {titel}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Veld({ label, children, span = 1 }: { label: string; children: ReactNode; span?: 1 | 2 }) {
  return (
    <div className={`space-y-1.5 ${span === 2 ? 'sm:col-span-2' : ''}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
