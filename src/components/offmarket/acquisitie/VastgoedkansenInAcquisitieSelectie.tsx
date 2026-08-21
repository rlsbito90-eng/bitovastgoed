import { useEffect } from 'react';
import { Archive, ExternalLink, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import {
  type AcquisitieSelectieItem,
  useVerwijderVastgoedkansUitAcquisitieSelectie,
} from '@/hooks/useAcquisitieSelectie';
import { HERKOMST_LABEL, PRIORITEIT_LABEL, STATUS_LABEL, kansTitel } from '@/lib/vastgoedkansen';
import { VASTGOEDKANS_STATUS_PRESENTATIE } from '@/lib/vastgoedkansStatusPresentation';

interface Props {
  items: AcquisitieSelectieItem[];
}

export default function VastgoedkansenInAcquisitieSelectie({ items }: Props) {
  const { getKansById } = useVastgoedkansen();
  const verwijder = useVerwijderVastgoedkansUitAcquisitieSelectie();
  const [searchParams] = useSearchParams();
  const focusVastgoedkansId = searchParams.get('vastgoedkans');
  const kansItems = items.filter((item) => Boolean(item.vastgoedkans_id));

  useEffect(() => {
    if (!focusVastgoedkansId) return;
    const element = document.querySelector<HTMLElement>(`[data-vastgoedkans-id="${CSS.escape(focusVastgoedkansId)}"]`);
    if (!element) return;
    requestAnimationFrame(() => element.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }, [focusVastgoedkansId, kansItems.length]);

  if (kansItems.length === 0) return null;

  const verwijderUitSelectie = async (vastgoedkansId: string) => {
    try {
      await verwijder.mutateAsync(vastgoedkansId);
      toast.success('Vastgoedkans uit acquisitieselectie gehaald.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Uit acquisitieselectie halen mislukt.');
    }
  };

  return (
    <section className="section-card overflow-hidden" data-testid="acquisitie-vastgoedkansen">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Vastgoedkansen</p>
          <p className="text-xs text-muted-foreground">
            {kansItems.length} vastgoedkans{kansItems.length === 1 ? '' : 'en'} in deze gedeelde acquisitieselectie
          </p>
        </div>
        <Badge variant="outline">Gedeeld dossier</Badge>
      </div>
      <div className="divide-y divide-border/70">
        {kansItems.map((item) => {
          const kans = item.vastgoedkans_id ? getKansById(item.vastgoedkans_id) : undefined;
          const heeftFocus = Boolean(kans && focusVastgoedkansId === kans.id);
          if (!kans) {
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Vastgoedkans niet geladen ({item.vastgoedkans_id})</span>
                {item.vastgoedkans_id && (
                  <Button size="sm" variant="ghost" onClick={() => void verwijderUitSelectie(item.vastgoedkans_id!)}>
                    <X className="mr-1.5 h-4 w-4" />Uit selectie
                  </Button>
                )}
              </div>
            );
          }
          return (
            <div
              key={item.id}
              data-vastgoedkans-id={kans.id}
              className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 transition-colors ${heeftFocus ? 'bg-primary/5 ring-2 ring-inset ring-primary/30' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/vastgoedkansen/${kans.id}`} className="break-words text-sm font-medium hover:text-primary hover:underline">
                    {kansTitel(kans)}
                  </Link>
                  {heeftFocus && <Badge>Geselecteerd dossier</Badge>}
                  <Badge variant="outline" className={VASTGOEDKANS_STATUS_PRESENTATIE[kans.status].chip}>
                    {STATUS_LABEL[kans.status]}
                  </Badge>
                  <Badge variant="outline">{PRIORITEIT_LABEL[kans.prioriteit] ?? `P${kans.prioriteit}`}</Badge>
                  <Badge variant="outline">
                    {kans.herkomst === 'bag_selectie' ? 'Pandenverkenner' : HERKOMST_LABEL[kans.herkomst]}
                  </Badge>
                  {kans.archivedAt && <Badge variant="secondary"><Archive className="mr-1 h-3 w-3" />Gearchiveerd</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[kans.adres, kans.postcode, kans.plaats].filter(Boolean).join(', ') || 'Adres ontbreekt'}
                  {kans.eigenaarNaam ? ` · Eigenaar: ${kans.eigenaarNaam}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link to={`/vastgoedkansen/${kans.id}`}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={verwijder.isPending}
                  onClick={() => void verwijderUitSelectie(kans.id)}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />Uit selectie
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
