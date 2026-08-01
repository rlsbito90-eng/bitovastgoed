import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SlidersHorizontal } from 'lucide-react';
import {
  loadLayoutPrefs,
  saveLayoutPrefs,
  visibleWidgets,
  type VrLayoutPrefs,
} from '@/lib/vastgoedrekenen/workspaceLayoutPrefs';
import { VR_STATUS_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { buildVrWorkspaceHref } from '@/lib/vastgoedrekenen/workspaceNavigation';
import { buildQuickscanObjectHref } from '@/lib/vastgoedrekenen/quickscanNavigation';
import WerkruimteAanpassenDialog from './WerkruimteAanpassenDialog';
import { formatLaatsteActiviteit, type OverviewCalculation } from './types';

function Tegel({ label, waarde }: { label: string; waarde: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">{waarde}</p>
      </CardContent>
    </Card>
  );
}

export default function StartSectie({ items }: { items: OverviewCalculation[] }) {
  const [prefs, setPrefs] = useState<VrLayoutPrefs>(() => loadLayoutPrefs());
  const [dialogOpen, setDialogOpen] = useState(false);

  function updatePrefs(next: VrLayoutPrefs) {
    setPrefs(next);
    saveLayoutPrefs(next);
  }

  const statusTelling = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item.status, (map.get(item.status) ?? 0) + 1);
    return map;
  }, [items]);

  const recent = items.slice(0, 5);
  const zichtbaar = visibleWidgets(prefs);

  const widgets: Record<string, JSX.Element> = {
    statistieken: (
      <div key="statistieken" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tegel label="Berekeningen" waarde={items.length} />
        {[...statusTelling.entries()].slice(0, 3).map(([status, aantal]) => (
          <Tegel
            key={status}
            label={VR_STATUS_LABELS[status as keyof typeof VR_STATUS_LABELS] ?? status}
            waarde={aantal}
          />
        ))}
      </div>
    ),
    recent: (
      <Card key="recent">
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-medium">Recente berekeningen</p>
          {recent.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nog geen berekeningen.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {recent.map((item) => (
                <li key={item.id} className="py-2">
                  <Link
                    to={buildQuickscanObjectHref(item.object_id, item.id)}
                    className="flex items-baseline justify-between gap-3 text-sm hover:underline"
                  >
                    <span className="min-w-0 truncate">
                      {item.object_naam} · <span className="text-muted-foreground">{item.calculation_name}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatLaatsteActiviteit(item.latest_activity_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    ),
    snelacties: (
      <Card key="snelacties">
        <CardContent className="flex flex-wrap gap-2 p-4">
          <Button asChild>
            <Link to={buildVrWorkspaceHref('projecten')}>Naar Projecten &amp; cases</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={buildVrWorkspaceHref('bibliotheek')}>Naar Bibliotheek</Link>
          </Button>
        </CardContent>
      </Card>
    ),
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          data-testid="vr-werkruimte-aanpassen"
          onClick={() => setDialogOpen(true)}
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Werkruimte aanpassen
        </Button>
      </div>

      {zichtbaar.map((id) => widgets[id])}

      <WerkruimteAanpassenDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prefs={prefs}
        onChange={updatePrefs}
      />
    </div>
  );
}
