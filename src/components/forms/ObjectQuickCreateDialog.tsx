// src/components/forms/ObjectQuickCreateDialog.tsx
//
// Fase 1A — Lichtgewicht create-flow voor nieuwe objecten.
// Alleen kernvelden; alle overige velden blijven NULL/server-default en worden
// later ingevuld via de bestaande edit-flow (ObjectFormDialog) op de detailpagina.
//
// Bewust:
// - Geen tabs, geen dossier, geen IM-content, geen media, geen berekende financials.
// - Ontwikkellocatie / grondpositie / transformatie zijn géén asset-class in deze
//   quick-create (fase 1A). mixed_use blijft wel beschikbaar.
// - EntityPicker toont uitsluitend naam + bedrijf; geen e-mail in het label.
// - Bestaande submit-flow (useDataStore.addObject) wordt hergebruikt.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { NumberField } from '@/components/ui/number-field';

import { useDataStore } from '@/hooks/useDataStore';
import type { AssetClass, ObjectStatus, Aanbiedingswijze } from '@/data/mock-data';
import {
  ASSET_CLASS_LABELS,
  OBJECT_STATUS_LABELS,
  AANBIEDINGSWIJZE_LABELS,
  PROVINCIES,
} from '@/data/mock-data';
import SubcategorieSelect from '@/components/object/SubcategorieSelect';
import EntityPicker, { type EntityPickerItem } from '@/components/forms/EntityPicker';
import { getRelatieNamen } from '@/lib/relatieNaam';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Asset-class opties voor quick-create.
// Bewust weggelaten: 'ontwikkellocatie' — dat is potentie/projectstatus, geen
// asset-class. Wordt in fase 3/4/5 hermapt naar potentie_strategie.
const QUICK_ASSET_CLASSES: AssetClass[] = [
  'wonen',
  'winkels',
  'kantoren',
  'logistiek',
  'bedrijfshallen',
  'industrieel',
  'hotels',
  'zorgvastgoed',
  'mixed_use',
];

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

export default function ObjectQuickCreateDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { addObject, relaties, contactpersonen } = useDataStore();

  const [titel, setTitel] = useState('');
  const [status, setStatus] = useState<ObjectStatus>('te_beoordelen');
  const [aanbiedingswijze, setAanbiedingswijze] = useState<Aanbiedingswijze>('off_market');
  const [anoniem, setAnoniem] = useState(true);
  // Locatie: als anoniem → publiekeRegio; anders adres + postcode + plaats + provincie.
  const [publiekeRegio, setPubliekeRegio] = useState('');
  const [adres, setAdres] = useState('');
  const [postcode, setPostcode] = useState('');
  const [plaats, setPlaats] = useState('');
  const [provincie, setProvincie] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>('wonen');
  const [subcategorieId, setSubcategorieId] = useState<string | undefined>(undefined);
  const [bron, setBron] = useState('');
  const [relatieId, setRelatieId] = useState<string>('');
  const [vraagprijs, setVraagprijs] = useState<number | undefined>(undefined);
  const [prijsindicatie, setPrijsindicatie] = useState('');
  const [notitie, setNotitie] = useState('');
  const [bezig, setBezig] = useState(false);

  // EntityPicker items voor relaties: label = alleen naam + bedrijf.
  // getRelatieNamen valt nooit terug op e-mail; secundair = bedrijfsnaam of null.
  const relatieItems = useMemo<EntityPickerItem[]>(() => {
    return relaties
      .filter((r) => !(r as any).isArchived)
      .map((r) => {
        const { primair, secundair } = getRelatieNamen(r, contactpersonen);
        // Zoeken mag breder (haystack), maar het zichtbare label blijft strikt naam+bedrijf.
        const haystack = norm(
          [primair, secundair, r.bedrijfsnaam, r.contactpersoon].filter(Boolean).join(' '),
        );
        return {
          id: r.id,
          primair,
          secundair: secundair ?? null,
          searchHaystack: haystack,
        };
      });
  }, [relaties, contactpersonen]);

  const reset = () => {
    setTitel('');
    setStatus('te_beoordelen');
    setAanbiedingswijze('off_market');
    setAnoniem(true);
    setPubliekeRegio('');
    setAdres('');
    setPostcode('');
    setPlaats('');
    setProvincie('');
    setAssetClass('wonen');
    setSubcategorieId(undefined);
    setBron('');
    setRelatieId('');
    setVraagprijs(undefined);
    setPrijsindicatie('');
    setNotitie('');
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (bezig) return;
    const titelClean = titel.trim();
    if (!titelClean) {
      toast.error('Titel / objectnaam is verplicht');
      return;
    }

    // Bouw payload met alleen ingevulde velden. Overige DB-kolommen blijven
    // NULL of behouden hun server-default (zie useDataStore.addObject).
    const selectedRelatie = relatieId
      ? relaties.find((r) => r.id === relatieId)
      : null;
    // Voor de gekoppelde verkoper vullen we het bestaande vrije-tekst
    // verkoperNaam-veld met "naam – bedrijf" (geen e-mail). De echte FK-koppeling
    // via eigenaar_relatie_id volgt in Fase 3.
    let verkoperNaam: string | undefined;
    if (selectedRelatie) {
      const { primair, secundair } = getRelatieNamen(selectedRelatie, contactpersonen);
      verkoperNaam = secundair ? `${primair} – ${secundair}` : primair;
    }

    const payload: Record<string, unknown> = {
      titel: titelClean,
      anoniem,
      status,
      aanbiedingswijze,
      type: assetClass,
      subcategorieId: subcategorieId ?? undefined,
      bron: bron.trim() || undefined,
      vraagprijs: typeof vraagprijs === 'number' && Number.isFinite(vraagprijs) ? vraagprijs : undefined,
      prijsindicatie: prijsindicatie.trim() || undefined,
      interneOpmerkingen: notitie.trim() || undefined,
      verkoperNaam,
      verkoperVia: 'onbekend',
      // Locatie afhankelijk van anonimiteit:
      publiekeRegio: anoniem ? (publiekeRegio.trim() || undefined) : undefined,
      adres: !anoniem ? (adres.trim() || undefined) : undefined,
      postcode: !anoniem ? (postcode.trim() || undefined) : undefined,
      plaats: !anoniem ? (plaats.trim() || '') : '',
      provincie: !anoniem ? (provincie.trim() || '') : '',
      // Verplichte kolommen met bewuste defaults:
      verhuurStatus: 'leeg',
      exclusief: false,
      asbestinventarisatieAanwezig: false,
      ontwikkelPotentie: false,
      transformatiePotentie: false,
      isPortefeuille: false,
      documentenBeschikbaar: false,
      markeerAlsReferentie: false,
      referentieanalyseZichtbaar: true,
      datumToegevoegd: new Date().toISOString().split('T')[0],
    };

    setBezig(true);
    try {
      const nieuw = await addObject(payload as any);
      if (nieuw?.id) {
        toast.success('Object aangemaakt — vul dossier aan wanneer beschikbaar.');
        reset();
        onOpenChange(false);
        navigate(`/objecten/${nieuw.id}`);
      } else {
        toast.error('Object kon niet worden aangemaakt');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Opslaan mislukt');
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nieuw object</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1" style={{ maxHeight: '70vh' }}>
          {/* Titel */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-titel">
              Titel / objectnaam <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quick-titel"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="bv. Portefeuille Amsterdam Zuid"
              autoFocus
            />
          </div>

          {/* Status + aanbiedingswijze */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quick-status">Status</Label>
              <select
                id="quick-status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as ObjectStatus)}
              >
                {(Object.keys(OBJECT_STATUS_LABELS) as ObjectStatus[]).map((s) => (
                  <option key={s} value={s}>{OBJECT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-aanbiedingswijze">Aanbiedingswijze</Label>
              <select
                id="quick-aanbiedingswijze"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={aanbiedingswijze}
                onChange={(e) => setAanbiedingswijze(e.target.value as Aanbiedingswijze)}
              >
                {(Object.keys(AANBIEDINGSWIJZE_LABELS) as Aanbiedingswijze[]).map((a) => (
                  <option key={a} value={a}>{AANBIEDINGSWIJZE_LABELS[a]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Locatie / anonimiteit */}
          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Anoniem tonen</p>
                <p className="text-xs text-muted-foreground">
                  Toon alleen een publieke regio in plaats van het exacte adres.
                </p>
              </div>
              <Switch checked={anoniem} onCheckedChange={setAnoniem} aria-label="Anoniem tonen" />
            </div>

            {anoniem ? (
              <div className="space-y-1.5">
                <Label htmlFor="quick-regio">Publieke regio</Label>
                <Input
                  id="quick-regio"
                  value={publiekeRegio}
                  onChange={(e) => setPubliekeRegio(e.target.value)}
                  placeholder="bv. Randstad, Noord-Holland"
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="quick-adres">Adres</Label>
                  <Input
                    id="quick-adres"
                    value={adres}
                    onChange={(e) => setAdres(e.target.value)}
                    placeholder="Straat en huisnummer"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quick-postcode">Postcode</Label>
                  <Input
                    id="quick-postcode"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="1234 AB"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quick-plaats">Plaats</Label>
                  <Input
                    id="quick-plaats"
                    value={plaats}
                    onChange={(e) => setPlaats(e.target.value)}
                    placeholder="bv. Amsterdam"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="quick-provincie">Provincie</Label>
                  <select
                    id="quick-provincie"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={provincie}
                    onChange={(e) => setProvincie(e.target.value)}
                  >
                    <option value="">— Kies provincie —</option>
                    {PROVINCIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Type vastgoed */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quick-type">Type vastgoed</Label>
              <select
                id="quick-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={assetClass}
                onChange={(e) => {
                  setAssetClass(e.target.value as AssetClass);
                  setSubcategorieId(undefined);
                }}
              >
                {QUICK_ASSET_CLASSES.map((ac) => (
                  <option key={ac} value={ac}>{ASSET_CLASS_LABELS[ac]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Subcategorie</Label>
              <SubcategorieSelect
                assetClass={assetClass}
                value={subcategorieId}
                onChange={setSubcategorieId}
              />
            </div>
          </div>

          {/* Bron */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-bron">Bron</Label>
            <Input
              id="quick-bron"
              value={bron}
              onChange={(e) => setBron(e.target.value)}
              placeholder="bv. eigen netwerk, makelaar"
            />
          </div>

          {/* Gekoppelde relatie */}
          <EntityPicker
            label="Gekoppelde relatie (optioneel)"
            pickerTitle="Kies verkoper of eigenaar"
            searchPlaceholder="Zoek relatie op naam of bedrijf…"
            emptyLabel="Geen gekoppelde relatie"
            value={relatieId}
            onChange={setRelatieId}
            items={relatieItems}
          />

          {/* Prijs */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quick-vraagprijs">Vraagprijs (€, optioneel)</Label>
              <NumberField
                id="quick-vraagprijs"
                value={vraagprijs}
                onChange={setVraagprijs}
                placeholder="0"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-prijsindicatie">Prijsindicatie (optioneel)</Label>
              <Input
                id="quick-prijsindicatie"
                value={prijsindicatie}
                onChange={(e) => setPrijsindicatie(e.target.value)}
                placeholder="bv. €5–6 mln"
              />
            </div>
          </div>

          {/* Interne notitie */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-notitie">Interne notitie (optioneel)</Label>
            <Textarea
              id="quick-notitie"
              value={notitie}
              onChange={(e) => setNotitie(e.target.value)}
              placeholder="Korte interne aantekening…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={bezig}>
            Annuleren
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={bezig}>
            {bezig ? 'Bezig…' : 'Object aanmaken'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
