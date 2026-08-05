import { Building2, Copy, ExternalLink, Map, MapPin, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AcquisitieBagOverzicht from '@/components/acquisitie/AcquisitieBagOverzicht';
import { bouwAcquisitieBagContext } from '@/lib/acquisitieBagContext';
import type { VastgoedkansOnderzoekModel } from '@/lib/vastgoedkansOnderzoek';

interface Props {
  model: VastgoedkansOnderzoekModel;
  onOpenKadaster: () => void;
}

function ExterneActie({ href, label, icon: Icon }: { href: string | null; label: string; icon: typeof MapPin }) {
  return (
    <Button asChild={Boolean(href)} size="sm" variant="outline" disabled={!href}>
      {href ? <a href={href} target="_blank" rel="noreferrer"><Icon className="mr-1.5 h-4 w-4" />{label}<ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a> : <span><Icon className="mr-1.5 h-4 w-4" />{label}</span>}
    </Button>
  );
}

export default function VastgoedkansOnderzoekWerkplek({ model, onOpenKadaster }: Props) {
  const kopieerAdres = async () => {
    if (!model.adres) return;
    await navigator.clipboard.writeText(model.adres);
    toast.success('Adres gekopieerd.');
  };

  const bagContext = bouwAcquisitieBagContext({
    bag_status: model.heeftBagKoppeling ? 'verrijkt' : 'niet_verrijkt',
    bag_match_kwaliteit: model.heeftBagKoppeling ? 'bestaande_koppeling' : null,
    bag_geselecteerd_adres: model.adres || null,
    bag_geselecteerd_vbo_id: model.bagVerblijfsobjectId,
    bag_geselecteerd_pand_id: model.bagPandId,
  });

  return (
    <div className="space-y-4" data-testid="vastgoedkans-onderzoek-werkplek">
      <section className="section-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><h2 className="font-medium">Onderzoeksacties</h2></div>
            <p className="mt-1 text-sm text-muted-foreground">Dezelfde eerste onderzoeksroute als Off-Market Radar, toegepast op deze Vastgoedkans.</p>
          </div>
          <Badge variant="outline">{model.herkomstLabel || 'Herkomst onbekend'}</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <ExterneActie href={model.mapsUrl} label="Open in Google Maps" icon={MapPin} />
          <ExterneActie href={model.googleUrl} label="Zoek adres op Google" icon={Search} />
          <ExterneActie href={model.bagViewerUrl} label="Open in BAG Viewer" icon={Building2} />
          <ExterneActie href={model.kadastraleKaartUrl} label="Open KadastraleKaart" icon={Map} />
          <Button size="sm" variant="outline" onClick={kopieerAdres} disabled={!model.adres}><Copy className="mr-1.5 h-4 w-4" />Kopieer adres</Button>
        </div>
      </section>

      <AcquisitieBagOverzicht context={bagContext} onOpenKadaster={onOpenKadaster} />

      <section className="section-card p-4 sm:p-5">
        <h2 className="font-medium">Selectiecontext</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-muted-foreground">Selectiescore</p><p className="mt-1 text-sm font-medium">{model.score ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Toelichting</p><p className="mt-1 text-sm text-muted-foreground">{model.scoreUitleg || 'Geen score-uitleg opgeslagen.'}</p></div>
        </div>
        {!model.heeftBagKoppeling && <p className="mt-4 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">Er is nog geen BAG-object aan deze kans gekoppeld. Er wordt in deze tranche niets automatisch verrijkt of naar Kadaster verzonden.</p>}
      </section>
    </div>
  );
}
