// src/components/forms/RelatieFormDialog.tsx
// Complete nieuwe Relatie-form met 4 tabs:
//   1. Algemeen       — bedrijfsnaam, type, subtype, lead status, KVK
//   2. Investeerder   — budget, rendementseis, kapitaalsituatie, dealstructuur
//   3. Contact        — voorkeur kanaal + taal, NDA, contactpersonen
//   4. Notities       — aankoopcriteria, verkoopintentie, notities
// Multi-select chips voor regio + asset classes i.p.v. komma-strings.

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
import ContactpersonenPanel from '@/components/relatie/ContactpersonenPanel';
import { Users, Info } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatie?: Relatie | null;
}

type FormState = Omit<Relatie, 'id' | 'laatsteContact' | 'softDeletedAt' | 'contactpersoon'>;

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
  const { addRelatie, updateRelatie } = useDataStore();
  const isEdit = !!relatie;
  const [gemaaktId, setGemaaktId] = useState<string | undefined>(relatie?.id);
  const relatieId = relatie?.id ?? gemaaktId;

  const [form, setForm] = useState<FormState>(leegForm);
  const [bezig, setBezig] = useState(false);
  const [tab, setTab] = useState('algemeen');

  useEffect(() => {
    if (relatie) {
      const { id, laatsteContact, softDeletedAt, contactpersoon, ...rest } = relatie;
      setForm({ ...leegForm, ...rest });
      setGemaaktId(relatie.id);
    } else {
      setForm(leegForm);
      setGemaaktId(undefined);
    }
    setTab('algemeen');
  }, [relatie, open]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const num = (v: string) => v === '' ? undefined : Number(v);

  const handleSave = async () => {
    if (bezig) return;
    if (!form.bedrijfsnaam.trim()) {
      toast.error('Bedrijfsnaam is verplicht');
      setTab('algemeen');
      return;
    }
    setBezig(true);

    const data = { ...form, bedrijfsnaam: form.bedrijfsnaam.trim() };

    try {
      if (isEdit && relatie) {
        await updateRelatie(relatie.id, data);
        toast.success('Relatie bijgewerkt');
      } else if (gemaaktId) {
        await updateRelatie(gemaaktId, data);
        toast.success('Relatie bijgewerkt');
      } else {
        const nieuw = await addRelatie({
          ...data,
          laatsteContact: new Date().toISOString().split('T')[0],
          contactpersoon: '', // legacy veld; nieuwe structuur via contactpersonen-tabel
        } as Omit<Relatie, 'id'>);
        if (nieuw?.id) {
          setGemaaktId(nieuw.id);
          toast.success('Relatie aangemaakt — je kunt nu contactpersonen toevoegen');
        }
      }
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
              <TabsTrigger value="investeerder">Investeerder</TabsTrigger>
              <TabsTrigger value="contact" disabled={!relatieId}>
                <span className="hidden sm:inline">Contact</span>
                <Users className="h-4 w-4 sm:hidden" />
              </TabsTrigger>
              <TabsTrigger value="notities">Notities</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {/* ALGEMEEN */}
            <TabsContent value="algemeen" className="space-y-5 mt-0">
              <Sectie titel="Bedrijfsgegevens">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Bedrijfsnaam *" span={2}>
                    <Input value={form.bedrijfsnaam} onChange={e => set('bedrijfsnaam', e.target.value)} />
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

              <Sectie titel="Directe contactgegevens (fallback)">
                <div className="p-3 bg-muted/40 rounded-md flex items-start gap-2 mb-3">
                  <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Vul hier de hoofdcontactgegevens van het bedrijf in. Individuele contactpersonen
                    beheer je op de Contact-tab.
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
            </TabsContent>

            {/* INVESTEERDER */}
            <TabsContent value="investeerder" className="space-y-5 mt-0">
              <Sectie titel="Asset classes van interesse">
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
            </TabsContent>

            {/* CONTACT */}
            <TabsContent value="contact" className="space-y-5 mt-0">
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

              <Sectie titel="Contactpersonen">
                {relatieId ? (
                  <ContactpersonenPanel relatieId={relatieId} />
                ) : (
                  <div className="border border-dashed border-border rounded-md p-6 text-center">
                    <Users className="h-6 w-6 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">
                      Sla de relatie eerst op om contactpersonen toe te voegen.
                    </p>
                  </div>
                )}
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

function Veld({ label, children, span = 1 }: { label: string; children: ReactNode; span?: 1 | 2 }) {
  return (
    <div className={`space-y-1.5 ${span === 2 ? 'sm:col-span-2' : ''}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
