import { useEffect, useMemo, useState } from 'react';
import { Archive, ExternalLink, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import {
  type AcquisitieSelectieItem,
  useVerwijderVastgoedkansUitAcquisitieSelectie,
} from '@/hooks/useAcquisitieSelectie';
import { HERKOMST_LABEL, PRIORITEIT_LABEL, STATUS_LABEL, kansTitel, type Vastgoedkans } from '@/lib/vastgoedkansen';
import { VASTGOEDKANS_STATUS_PRESENTATIE } from '@/lib/vastgoedkansStatusPresentation';
import PandenverkennerProductiekernActies from '@/components/acquisitie/PandenverkennerProductiekernActies';
import PandenverkennerBulkKadasterDialog from '@/components/acquisitie/PandenverkennerBulkKadasterDialog';
import PandenverkennerBulkBriefDialog from '@/components/acquisitie/PandenverkennerBulkBriefDialog';

interface Props { items: AcquisitieSelectieItem[]; }

export default function VastgoedkansenInAcquisitieSelectie({ items }: Props) {
  const { getKansById } = useVastgoedkansen();
  const verwijder = useVerwijderVastgoedkansUitAcquisitieSelectie();
  const [searchParams] = useSearchParams();
  const focusVastgoedkansId = searchParams.get('vastgoedkans');
  const kansItems = items.filter((item) => Boolean(item.vastgoedkans_id));
  const [geselecteerd,setGeselecteerd]=useState<Set<string>>(new Set());
  const [kadasterOpen,setKadasterOpen]=useState(false);
  const [briefOpen,setBriefOpen]=useState(false);

  const kansen=useMemo(()=>kansItems.map(i=>i.vastgoedkans_id?getKansById(i.vastgoedkans_id):undefined).filter((k):k is Vastgoedkans=>Boolean(k)),[kansItems,getKansById]);
  const geselecteerdeKansen=useMemo(()=>kansen.filter(k=>geselecteerd.has(k.id)),[kansen,geselecteerd]);
  const allesGeselecteerd=kansen.length>0&&kansen.every(k=>geselecteerd.has(k.id));

  useEffect(() => {
    if (!focusVastgoedkansId) return;
    const element = document.querySelector<HTMLElement>(`[data-vastgoedkans-id="${CSS.escape(focusVastgoedkansId)}"]`);
    if (!element) return;
    requestAnimationFrame(() => element.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }, [focusVastgoedkansId, kansItems.length]);

  useEffect(()=>{setGeselecteerd(v=>new Set([...v].filter(id=>kansen.some(k=>k.id===id))))},[kansen.length]);
  if (kansItems.length === 0) return null;

  const toggle=(id:string)=>setGeselecteerd(v=>{const n=new Set(v);n.has(id)?n.delete(id):n.add(id);return n});
  const toggleAlles=()=>setGeselecteerd(allesGeselecteerd?new Set():new Set(kansen.map(k=>k.id)));
  const verwijderUitSelectie = async (vastgoedkansId: string) => {
    try { await verwijder.mutateAsync(vastgoedkansId); toast.success('Vastgoedkans uit acquisitieselectie gehaald.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Uit acquisitieselectie halen mislukt.'); }
  };

  return (
    <section className="section-card overflow-hidden" data-testid="acquisitie-vastgoedkansen">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div><p className="text-sm font-medium">Pandenverkenner / Vastgoedkansen</p><p className="text-xs text-muted-foreground">{kansItems.length} dossier{kansItems.length === 1 ? '' : 's'} · eigen briefprofielen, gedeelde BR/BAT-productiekern</p></div>
        <Badge variant="outline">Bron blijft gescheiden van Radar</Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/10 px-4 py-3" data-testid="pandenverkenner-bulk-actiebalk">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={allesGeselecteerd} onCheckedChange={toggleAlles}/><span>{geselecteerd.size} geselecteerd</span></label>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={geselecteerdeKansen.length===0} onClick={()=>setKadasterOpen(true)}>Bulk Kadaster</Button><Button size="sm" variant="outline" disabled={geselecteerdeKansen.length===0} onClick={()=>setBriefOpen(true)}>Bulk brieven maken</Button></div>
      </div>

      <div className="divide-y divide-border/70">
        {kansItems.map((item) => {
          const kans = item.vastgoedkans_id ? getKansById(item.vastgoedkans_id) : undefined;
          const heeftFocus = Boolean(kans && focusVastgoedkansId === kans.id);
          if (!kans) return <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="text-muted-foreground">Vastgoedkans niet geladen ({item.vastgoedkans_id})</span>{item.vastgoedkans_id && <Button size="sm" variant="ghost" onClick={() => void verwijderUitSelectie(item.vastgoedkans_id!)}><X className="mr-1.5 h-4 w-4" />Uit selectie</Button>}</div>;
          return (
            <div key={item.id} data-vastgoedkans-id={kans.id} className={`px-4 py-3 transition-colors ${heeftFocus ? 'bg-primary/5 ring-2 ring-inset ring-primary/30' : ''}`}>
              <div className="flex items-start gap-3">
                <Checkbox className="mt-1 shrink-0" checked={geselecteerd.has(kans.id)} onCheckedChange={()=>toggle(kans.id)} aria-label={`Selecteer ${kansTitel(kans)}`}/>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link to={`/vastgoedkansen/${kans.id}`} className="break-words text-sm font-medium hover:text-primary hover:underline">{kansTitel(kans)}</Link>{heeftFocus && <Badge>Geselecteerd dossier</Badge>}<Badge variant="outline" className={VASTGOEDKANS_STATUS_PRESENTATIE[kans.status].chip}>{STATUS_LABEL[kans.status]}</Badge><Badge variant="outline">{PRIORITEIT_LABEL[kans.prioriteit] ?? `P${kans.prioriteit}`}</Badge><Badge variant="outline">{kans.herkomst === 'bag_selectie' ? 'Pandenverkenner' : HERKOMST_LABEL[kans.herkomst]}</Badge>{kans.archivedAt && <Badge variant="secondary"><Archive className="mr-1 h-3 w-3" />Gearchiveerd</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{[kans.adres, kans.postcode, kans.plaats].filter(Boolean).join(', ') || 'Adres ontbreekt'}{kans.eigenaarNaam ? ` · Eigenaar: ${kans.eigenaarNaam}` : ' · Algemene eigenaarspost toegestaan'}</p></div>
                    <div className="flex shrink-0 flex-wrap gap-2"><Button asChild size="sm" variant="secondary"><Link to={`/vastgoedkansen/${kans.id}`}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open</Link></Button><Button size="sm" variant="ghost" disabled={verwijder.isPending} onClick={() => void verwijderUitSelectie(kans.id)}><X className="mr-1.5 h-3.5 w-3.5" />Uit selectie</Button></div>
                  </div>
                  <PandenverkennerProductiekernActies vastgoedkansId={kans.id} compact />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <PandenverkennerBulkKadasterDialog open={kadasterOpen} onOpenChange={setKadasterOpen} kansen={geselecteerdeKansen}/>
      <PandenverkennerBulkBriefDialog open={briefOpen} onOpenChange={setBriefOpen} kansen={geselecteerdeKansen}/>
    </section>
  );
}
