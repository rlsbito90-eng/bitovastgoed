import { useMemo, useState } from 'react';
import { Database, Euro, Loader2, RefreshCw, Settings2, ShieldAlert } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useKadasterKostenbeheer, type KadasterPeriode } from '@/hooks/useKadasterKostenbeheer';

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

export default function KadasterKostenPage() {
  const { isAdmin } = useAuth();
  const [periode, setPeriode] = useState<KadasterPeriode>('maand');
  const beheer = useKadasterKostenbeheer(periode);
  const bedrijfsbudget = useMemo(() => beheer.budgetten.find(item => item.scope_type === 'bedrijf' && item.scope_id === 'bito-vastgoed'), [beheer.budgetten]);
  const [daglimiet, setDaglimiet] = useState('');
  const [maandlimiet, setMaandlimiet] = useState('');
  const [bevestigingVanaf, setBevestigingVanaf] = useState('');
  const [hardeBlokkade, setHardeBlokkade] = useState(false);
  const [opslaan, setOpslaan] = useState(false);

  const vulBudget = () => {
    setDaglimiet(bedrijfsbudget?.daglimiet?.toString() ?? '');
    setMaandlimiet(bedrijfsbudget?.maandlimiet?.toString() ?? '');
    setBevestigingVanaf(bedrijfsbudget?.bevestiging_vanaf?.toString() ?? '');
    setHardeBlokkade(Boolean(bedrijfsbudget?.harde_blokkade));
  };

  const bewaarBudget = async () => {
    setOpslaan(true);
    try {
      await beheer.slaBedrijfsbudgetOp({
        daglimiet: daglimiet ? Number(daglimiet) : null,
        maandlimiet: maandlimiet ? Number(maandlimiet) : null,
        bevestiging_vanaf: bevestigingVanaf ? Number(bevestigingVanaf) : null,
        harde_blokkade: hardeBlokkade,
        beheerder_override: true,
        waarschuwing_percentages: [70, 85, 100],
      });
      toast.success('Kadasterbudget opgeslagen.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Budget opslaan mislukt.');
    } finally {
      setOpslaan(false);
    }
  };

  return <div className="page-shell-wide">
    <PageHeader title="Kadasterkosten" subtitle="Aantal aanvragen, geleverde producten, werkelijke kosten en beheerbare budgetten." />

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex rounded-md border p-1">
        {(['week','maand','jaar'] as KadasterPeriode[]).map(item => <Button key={item} size="sm" variant={periode === item ? 'secondary' : 'ghost'} onClick={() => setPeriode(item)} className="capitalize">{item}</Button>)}
      </div>
      <Button variant="outline" onClick={() => void beheer.laad()} disabled={beheer.loading}><RefreshCw className={`mr-2 h-4 w-4 ${beheer.loading ? 'animate-spin' : ''}`}/>Vernieuwen</Button>
    </div>

    {!beheer.schemaBeschikbaar && <div className="section-card border-amber-500/30 bg-amber-500/5 p-5"><div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600"/><div><p className="font-medium">Kostenbeheer is voorbereid maar nog niet geactiveerd</p><p className="mt-1 text-sm text-muted-foreground">De repositorymigratie is nog niet toegepast. Er worden geen Kadastergegevens opgevraagd en er worden geen kosten gemaakt.</p></div></div></div>}

    {beheer.loading ? <div className="section-card flex items-center justify-center p-12 text-sm text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Kadasterkosten laden…</div> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Database} label="Aanvragen" waarde={String(beheer.samenvatting.aanvragen)} toelichting={`${beheer.samenvatting.geleverd} geleverd`} />
        <Kpi icon={Euro} label="Werkelijke kosten" waarde={euro.format(beheer.samenvatting.werkelijk)} toelichting="Alleen geleverd/gedeeltelijk geleverd" />
        <Kpi icon={Euro} label="Geraamde kosten" waarde={euro.format(beheer.samenvatting.geraamd)} toelichting="Vooraf geregistreerd" />
        <Kpi icon={Settings2} label="Maandbudget" waarde={bedrijfsbudget?.maandlimiet != null ? euro.format(bedrijfsbudget.maandlimiet) : 'Niet ingesteld'} toelichting={bedrijfsbudget?.harde_blokkade ? 'Harde blokkade actief' : 'Waarschuwing / beheerderoverride'} />
      </div>

      <section className="section-card overflow-hidden">
        <div className="border-b p-4"><h2 className="text-sm font-medium">Producten in deze periode</h2><p className="text-xs text-muted-foreground">Aantal aanvragen, eenheden en daadwerkelijk geleverde kosten per Kadasterproduct.</p></div>
        {beheer.samenvatting.perProduct.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nog geen kosten-events in deze periode.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr><th className="p-3">Product</th><th className="p-3 text-right">Aanvragen</th><th className="p-3 text-right">Eenheden</th><th className="p-3 text-right">Geraamd</th><th className="p-3 text-right">Werkelijk</th></tr></thead><tbody className="divide-y">{beheer.samenvatting.perProduct.map(item => <tr key={item.code}><td className="p-3 font-medium">{item.naam}</td><td className="p-3 text-right">{item.aanvragen}</td><td className="p-3 text-right">{item.eenheden}</td><td className="p-3 text-right">{euro.format(item.geraamd)}</td><td className="p-3 text-right font-medium">{euro.format(item.werkelijk)}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="section-card overflow-hidden">
        <div className="border-b p-4"><h2 className="text-sm font-medium">Laatste aanvragen</h2><p className="text-xs text-muted-foreground">Auditoverzicht met product, adres, status, eenheden en kosten.</p></div>
        {beheer.events.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nog geen aanvragen geregistreerd.</div> : <div className="divide-y">{beheer.events.slice(0, 50).map(event => <div key={event.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="text-sm font-medium">{event.adres_label ?? event.product_code}</p><p className="text-xs text-muted-foreground">{new Date(event.aangevraagd_op).toLocaleString('nl-NL')} · {event.aantal_eenheden} eenheid{event.aantal_eenheden === 1 ? '' : 'en'}</p></div><Badge variant="outline">{event.status.replaceAll('_',' ')}</Badge><div className="text-right"><p className="text-sm font-medium">{euro.format(event.werkelijke_kosten ?? event.geraamde_kosten)}</p><p className="text-[11px] text-muted-foreground">{event.werkelijke_kosten == null ? 'geraamd' : 'werkelijk'}</p></div></div>)}</div>}
      </section>

      <section className="section-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-medium">Bedrijfsbudget</h2><p className="text-xs text-muted-foreground">Beheerder kan limieten altijd aanpassen. Betaalde aanvragen blijven afzonderlijk te bevestigen.</p></div>{isAdmin && <Button variant="outline" size="sm" onClick={vulBudget}>Huidige waarden laden</Button>}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3"><Input disabled={!isAdmin} type="number" min="0" step="0.01" value={daglimiet} onChange={e => setDaglimiet(e.target.value)} placeholder="Daglimiet (€)"/><Input disabled={!isAdmin} type="number" min="0" step="0.01" value={maandlimiet} onChange={e => setMaandlimiet(e.target.value)} placeholder="Maandlimiet (€)"/><Input disabled={!isAdmin} type="number" min="0" step="0.01" value={bevestigingVanaf} onChange={e => setBevestigingVanaf(e.target.value)} placeholder="Extra bevestiging vanaf (€)"/></div>
        <label className="mt-3 flex items-center gap-2 text-sm"><Checkbox disabled={!isAdmin} checked={hardeBlokkade} onCheckedChange={value => setHardeBlokkade(Boolean(value))}/>Harde budgetblokkade inschakelen</label>
        {isAdmin ? <Button className="mt-4" onClick={bewaarBudget} disabled={opslaan || !beheer.schemaBeschikbaar}>{opslaan && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Budget opslaan</Button> : <p className="mt-4 text-xs text-muted-foreground">Alleen een beheerder kan budgetten wijzigen.</p>}
      </section>

      <section className="section-card overflow-hidden">
        <div className="border-b p-4"><h2 className="text-sm font-medium">Kadasterproducten en tarieven</h2><p className="text-xs text-muted-foreground">Geen product wordt automatisch geactiveerd. Tarieven moeten door een beheerder worden gecontroleerd vóór gebruik.</p></div>
        <div className="divide-y">{beheer.producten.map(product => <ProductRegel key={product.code} product={product} isAdmin={isAdmin} onSave={beheer.werkProductBij} />)}</div>
      </section>
    </>}
  </div>;
}

function Kpi({ icon: Icon, label, waarde, toelichting }: { icon: typeof Euro; label: string; waarde: string; toelichting: string }) {
  return <div className="section-card p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4"/>{label}</div><p className="mt-2 text-xl font-semibold">{waarde}</p><p className="mt-1 text-[11px] text-muted-foreground">{toelichting}</p></div>;
}

function ProductRegel({ product, isAdmin, onSave }: { product: any; isAdmin: boolean; onSave: (code: string, waarden: any) => Promise<void> }) {
  const [tarief, setTarief] = useState(product.tarief_per_eenheid?.toString() ?? '');
  const [actief, setActief] = useState(Boolean(product.actief));
  const [bezig, setBezig] = useState(false);
  const save = async () => { setBezig(true); try { await onSave(product.code, { tarief_per_eenheid: tarief ? Number(tarief) : null, tarief_geldig_vanaf: new Date().toISOString().slice(0,10), actief, bevestiging_verplicht: product.categorie === 'betaald' }); toast.success(`${product.naam} bijgewerkt.`); } catch (error) { toast.error(error instanceof Error ? error.message : 'Product bijwerken mislukt.'); } finally { setBezig(false); } };
  return <div className="grid gap-3 p-4 md:grid-cols-[1fr_160px_auto_auto] md:items-center"><div><div className="flex items-center gap-2"><p className="text-sm font-medium">{product.naam}</p><Badge variant={product.categorie === 'gratis' ? 'secondary' : 'outline'}>{product.categorie}</Badge></div><p className="text-xs text-muted-foreground">Code {product.code}{product.tarief_geldig_vanaf ? ` · tarief vanaf ${product.tarief_geldig_vanaf}` : ''}</p></div><Input disabled={!isAdmin} type="number" min="0" step="0.0001" value={tarief} onChange={e => setTarief(e.target.value)} placeholder="Tarief per eenheid"/><label className="flex items-center gap-2 text-xs"><Checkbox disabled={!isAdmin} checked={actief} onCheckedChange={value => setActief(Boolean(value))}/>Actief</label>{isAdmin && <Button size="sm" variant="outline" onClick={save} disabled={bezig}>{bezig ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Opslaan'}</Button>}</div>;
}
