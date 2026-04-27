// src/components/forms/ZoekprofielFormDialog.tsx
// Complete nieuwe Zoekprofiel-form met tabs:
//   1. Basis           — naam, relatie, status, prioriteit
//   2. Wat             — asset classes, subcategorieën, regio's, steden
//   3. Kenmerken       — prijs, oppervlakte, bouwjaar, energielabel, verhuur, WALT
//   4. Voorkeuren      — transactietype, exclusiviteit, potentie, rendement

import { useState, useEffect, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDataStore } from '@/hooks/useDataStore';
import { useSubcategorieen } from '@/hooks/useSubcategorieen';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import {
  ASSET_CLASS_LABELS,
  EXCLUSIVITEIT_LABELS,
  REGIO_OPTIES,
} from '@/data/mock-data';
import type {
  Zoekprofiel, AssetClass, VerhuurStatus, ZoekprofielStatus,
  Energielabel, ExclusiviteitVoorkeur, Transactietype,
} from '@/data/mock-data';
import { toast } from 'sonner';
import MultiSelectChips from '@/components/object/MultiSelectChips';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zoekprofiel?: Zoekprofiel | null;
  defaultRelatieId?: string;
}

type FormState = Omit<Zoekprofiel, 'id'>;

const ENERGIELABELS: Energielabel[] =
  ['A++++','A+++','A++','A+','A','B','C','D','E','F','G','onbekend'];

const TRANSACTIETYPE_LABELS: Record<Transactietype, string> = {
  losse_aankoop: 'Losse aankoop',
  portefeuille: 'Portefeuille',
  jv: 'Joint venture',
  asset_deal: 'Asset deal',
  share_deal: 'Share deal',
};

const leegForm: FormState = {
  naam: '',
  relatieId: '',
  typeVastgoed: [],
  subcategorieIds: [],
  propertyTypeIds: [],
  propertySubtypeIds: [],
  dealTypeIds: [],
  regio: [],
  stad: undefined,
  steden: [],
  prijsMin: undefined,
  prijsMax: undefined,
  oppervlakteMin: undefined,
  oppervlakteMax: undefined,
  bouwjaarMin: undefined,
  bouwjaarMax: undefined,
  energielabelMin: undefined,
  verhuurStatus: undefined,
  rendementseis: undefined,
  waltMin: undefined,
  leegstandMaxPct: undefined,
  ontwikkelPotentie: false,
  transformatiePotentie: false,
  transactietypeVoorkeur: [],
  exclusiviteitVoorkeur: 'beide',
  prioriteit: 3,
  aanvullendeCriteria: undefined,
  status: 'actief',
};


export default function ZoekprofielFormDialog({
  open, onOpenChange, zoekprofiel, defaultRelatieId,
}: Props) {
  const { addZoekprofiel, updateZoekprofiel, relaties } = useDataStore();
  const { forAssetClass } = useSubcategorieen();
  const isEdit = !!zoekprofiel;

  const [form, setForm] = useState<FormState>(leegForm);
  const [bezig, setBezig] = useState(false);
  const [tab, setTab] = useState('basis');

  useEffect(() => {
    if (zoekprofiel) {
      const { id, ...rest } = zoekprofiel;
      setForm({ ...leegForm, ...rest });
    } else {
      setForm({ ...leegForm, relatieId: defaultRelatieId || '' });
    }
    setTab('basis');
  }, [zoekprofiel, open, defaultRelatieId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const num = (v: string) => v === '' ? undefined : Number(v);

  // Bij wijzigen van typeVastgoed: filter subcategorieIds zodat ze bij het type passen
  const setTypeVastgoed = (types: AssetClass[]) => {
    setForm(prev => {
      const geldigeSubs = prev.subcategorieIds?.filter(id => {
        const prefix = id.split('.')[0] as AssetClass;
        return types.includes(prefix);
      }) ?? [];
      return { ...prev, typeVastgoed: types, subcategorieIds: geldigeSubs };
    });
  };

  const handleSave = async () => {
    if (bezig) return;
    if (!form.relatieId) {
      toast.error('Kies een relatie waar dit zoekprofiel bij hoort');
      setTab('basis');
      return;
    }
    if (form.typeVastgoed.length === 0) {
      toast.error('Kies ten minste één type vastgoed');
      setTab('wat');
      return;
    }
    setBezig(true);

    const data = {
      ...form,
      naam: form.naam.trim() || 'Naamloos zoekprofiel',
    };

    try {
      if (isEdit && zoekprofiel) {
        await updateZoekprofiel(zoekprofiel.id, data);
        toast.success('Zoekprofiel bijgewerkt');
      } else {
        await addZoekprofiel(data);
        toast.success('Zoekprofiel aangemaakt');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Opslaan mislukt');
    } finally {
      setBezig(false);
    }
  };

  const assetOptions = Object.entries(ASSET_CLASS_LABELS).map(([value, label]) => ({ value, label }));
  const regioOptions = REGIO_OPTIES.map(r => ({ value: r, label: r }));
  const transactietypeOptions = Object.entries(TRANSACTIETYPE_LABELS).map(([value, label]) => ({ value, label }));

  // Subcategorie-opties op basis van gekozen asset classes
  const subcatOptions = form.typeVastgoed.flatMap(ac =>
    forAssetClass(ac).map(s => ({
      value: s.id,
      label: s.label,
      groep: ASSET_CLASS_LABELS[ac],
    }))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b border-border">
          <DialogTitle>
            {isEdit ? 'Zoekprofiel bewerken' : 'Nieuw zoekprofiel'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-6 pt-3 border-b border-border overflow-x-auto bg-background">
            <TabsList className="inline-flex">
              <TabsTrigger value="basis">Basis</TabsTrigger>
              <TabsTrigger value="wat">Wat</TabsTrigger>
              <TabsTrigger value="kenmerken">Kenmerken</TabsTrigger>
              <TabsTrigger value="voorkeuren">Voorkeuren</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {/* BASIS */}
            <TabsContent value="basis" className="space-y-5 mt-0">
              <Sectie titel="Algemeen">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Profielnaam" span={2}>
                    <Input value={form.naam} onChange={e => set('naam', e.target.value)}
                      placeholder="bv. Logistiek NH €5-15m" />
                  </Veld>
                  <Veld label="Gekoppelde relatie *">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.relatieId}
                      onChange={e => set('relatieId', e.target.value)}
                      disabled={!!defaultRelatieId && !isEdit}
                    >
                      <option value="">— Kies relatie —</option>
                      {relaties.map(r => (
                        <option key={r.id} value={r.id}>{r.bedrijfsnaam}</option>
                      ))}
                    </select>
                  </Veld>
                  <Veld label="Status">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.status}
                      onChange={e => set('status', e.target.value as ZoekprofielStatus)}
                    >
                      <option value="actief">Actief</option>
                      <option value="pauze">Pauze</option>
                      <option value="gearchiveerd">Gearchiveerd</option>
                    </select>
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Prioriteit">
                <div>
                  <Label>Prioriteit (1 = laag, 5 = hoog)</Label>
                  <div className="flex items-center gap-2 mt-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => set('prioriteit', n)}
                        className={`h-10 w-10 rounded-md border text-sm font-medium transition-colors ${
                          form.prioriteit === n
                            ? 'bg-accent text-accent-foreground border-accent'
                            : 'bg-card border-border hover:bg-muted'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <span className="text-xs text-muted-foreground ml-2">
                      {form.prioriteit <= 2 ? 'Nice-to-have' : form.prioriteit === 3 ? 'Normaal' : form.prioriteit === 4 ? 'Belangrijk' : 'Top prioriteit'}
                    </span>
                  </div>
                </div>
              </Sectie>
            </TabsContent>

            {/* WAT */}
            <TabsContent value="wat" className="space-y-5 mt-0">
              <Sectie titel="Type vastgoed *">
                <MultiSelectChips
                  options={assetOptions}
                  value={form.typeVastgoed}
                  onChange={v => setTypeVastgoed(v as AssetClass[])}
                />
              </Sectie>

              <Sectie titel="Subcategorieën (optioneel)">
                {form.typeVastgoed.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Kies eerst een type vastgoed om subcategorieën te zien.
                  </p>
                ) : subcatOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Geen subcategorieën beschikbaar voor de gekozen types.
                  </p>
                ) : (
                  <MultiSelectChips
                    options={subcatOptions}
                    value={form.subcategorieIds ?? []}
                    onChange={v => set('subcategorieIds', v)}
                  />
                )}
              </Sectie>

              <Sectie titel="Regio's">
                <MultiSelectChips
                  options={regioOptions}
                  value={form.regio}
                  onChange={v => set('regio', v)}
                />
              </Sectie>

              <Sectie titel="Specifieke steden (optioneel)">
                <Veld label="Steden (kommagescheiden)">
                  <Input
                    value={(form.steden ?? []).join(', ')}
                    onChange={e => set('steden', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="Amsterdam, Rotterdam, Utrecht"
                  />
                </Veld>
              </Sectie>
            </TabsContent>

            {/* KENMERKEN */}
            <TabsContent value="kenmerken" className="space-y-5 mt-0">
              <Sectie titel="Prijs">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Minimum (€)">
                    <Input type="number" value={form.prijsMin ?? ''}
                      onChange={e => set('prijsMin', num(e.target.value))} />
                  </Veld>
                  <Veld label="Maximum (€)">
                    <Input type="number" value={form.prijsMax ?? ''}
                      onChange={e => set('prijsMax', num(e.target.value))} />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Oppervlakte">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Minimum (m²)">
                    <Input type="number" value={form.oppervlakteMin ?? ''}
                      onChange={e => set('oppervlakteMin', num(e.target.value))} />
                  </Veld>
                  <Veld label="Maximum (m²)">
                    <Input type="number" value={form.oppervlakteMax ?? ''}
                      onChange={e => set('oppervlakteMax', num(e.target.value))} />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Bouwjaar & energielabel">
                <div className="grid sm:grid-cols-3 gap-4">
                  <Veld label="Bouwjaar minimum">
                    <Input type="number" value={form.bouwjaarMin ?? ''}
                      onChange={e => set('bouwjaarMin', num(e.target.value))} />
                  </Veld>
                  <Veld label="Bouwjaar maximum">
                    <Input type="number" value={form.bouwjaarMax ?? ''}
                      onChange={e => set('bouwjaarMax', num(e.target.value))} />
                  </Veld>
                  <Veld label="Energielabel minimum">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.energielabelMin ?? ''}
                      onChange={e => set('energielabelMin', (e.target.value || undefined) as Energielabel | undefined)}
                    >
                      <option value="">— Geen eis —</option>
                      {ENERGIELABELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Verhuur & rendement">
                <div className="grid sm:grid-cols-3 gap-4">
                  <Veld label="Verhuurstatus voorkeur">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.verhuurStatus ?? ''}
                      onChange={e => set('verhuurStatus', (e.target.value || undefined) as VerhuurStatus | undefined)}
                    >
                      <option value="">— Geen voorkeur —</option>
                      <option value="verhuurd">Verhuurd</option>
                      <option value="gedeeltelijk">Gedeeltelijk</option>
                      <option value="leeg">Leeg</option>
                    </select>
                  </Veld>
                  <Veld label="Rendementseis min (%)">
                    <Input type="number" step="0.01" value={form.rendementseis ?? ''}
                      onChange={e => set('rendementseis', num(e.target.value))} />
                  </Veld>
                  <Veld label="WALT minimum (jaren)">
                    <Input type="number" step="0.1" value={form.waltMin ?? ''}
                      onChange={e => set('waltMin', num(e.target.value))}
                      placeholder="bv. 5" />
                  </Veld>
                  <Veld label="Leegstand maximum (%)">
                    <Input type="number" step="0.1" value={form.leegstandMaxPct ?? ''}
                      onChange={e => set('leegstandMaxPct', num(e.target.value))} />
                  </Veld>
                </div>
              </Sectie>
            </TabsContent>

            {/* VOORKEUREN */}
            <TabsContent value="voorkeuren" className="space-y-5 mt-0">
              <Sectie titel="Transactietype">
                <MultiSelectChips
                  options={transactietypeOptions}
                  value={form.transactietypeVoorkeur ?? []}
                  onChange={v => set('transactietypeVoorkeur', v as Transactietype[])}
                />
              </Sectie>

              <Sectie titel="Marktaanbod">
                <Veld label="Exclusiviteit voorkeur">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.exclusiviteitVoorkeur ?? 'beide'}
                    onChange={e => set('exclusiviteitVoorkeur', e.target.value as ExclusiviteitVoorkeur)}
                  >
                    {Object.entries(EXCLUSIVITEIT_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Veld>
              </Sectie>

              <Sectie titel="Potentie">
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.ontwikkelPotentie}
                      onCheckedChange={v => set('ontwikkelPotentie', !!v)} />
                    Ontwikkelpotentie gewenst
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.transformatiePotentie}
                      onCheckedChange={v => set('transformatiePotentie', !!v)} />
                    Transformatiepotentie gewenst
                  </label>
                </div>
              </Sectie>

              <Sectie titel="Aanvullende criteria">
                <Veld label="Vrije tekst">
                  <Textarea rows={4} value={form.aanvullendeCriteria ?? ''}
                    onChange={e => set('aanvullendeCriteria', e.target.value || undefined)}
                    placeholder="Andere criteria die niet in de velden hierboven passen" />
                </Veld>
              </Sectie>
            </TabsContent>
          </div>

          <div className="shrink-0 border-t border-border px-6 py-3 flex justify-end items-center gap-2 bg-background">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button onClick={handleSave} disabled={bezig}>
              {bezig ? 'Bezig…' : (isEdit ? 'Opslaan' : 'Aanmaken')}
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
