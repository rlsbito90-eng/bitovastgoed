import { useDataStore } from '@/hooks/useDataStore';
import { getAllMatchesFromData } from '@/data/mock-data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function RapportagePage() {
  const { relaties, objecten, deals, taken, zoekprofielen } = useDataStore();
  const matches = getAllMatchesFromData(zoekprofielen, objecten);

  const dealsByFase = [
    { fase: 'Lead', aantal: deals.filter(d => d.fase === 'lead').length },
    { fase: 'Introductie', aantal: deals.filter(d => d.fase === 'introductie').length },
    { fase: 'Interesse', aantal: deals.filter(d => d.fase === 'interesse').length },
    { fase: 'Bezichtiging', aantal: deals.filter(d => d.fase === 'bezichtiging').length },
    { fase: 'Bieding', aantal: deals.filter(d => d.fase === 'bieding').length },
    { fase: 'Closing', aantal: deals.filter(d => ['closing', 'onderhandeling'].includes(d.fase)).length },
    { fase: 'Afgerond', aantal: deals.filter(d => d.fase === 'afgerond').length },
  ];

  const relatiesByStatus = [
    { name: 'Actief', value: relaties.filter(r => r.leadStatus === 'actief').length },
    { name: 'Warm', value: relaties.filter(r => r.leadStatus === 'warm').length },
    { name: 'Lauw', value: relaties.filter(r => r.leadStatus === 'lauw').length },
    { name: 'Koud', value: relaties.filter(r => r.leadStatus === 'koud').length },
  ];

  const COLORS = ['hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(215, 16%, 47%)', 'hsl(214, 32%, 91%)'];

  const objectenByType = objecten.reduce((acc, o) => {
    acc[o.type] = (acc[o.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Rapportage</h1>
        <p className="text-sm text-muted-foreground mt-1">Overzicht van dealflow en activiteit</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Relaties</p>
          <p className="text-2xl font-semibold font-mono-data text-foreground mt-1">{relaties.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Objecten</p>
          <p className="text-2xl font-semibold font-mono-data text-foreground mt-1">{objecten.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Deals</p>
          <p className="text-2xl font-semibold font-mono-data text-foreground mt-1">{deals.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Matches</p>
          <p className="text-2xl font-semibold font-mono-data text-foreground mt-1">{matches.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Open taken</p>
          <p className="text-2xl font-semibold font-mono-data text-foreground mt-1">{taken.filter(t => t.status !== 'afgerond').length}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Deals per fase</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dealsByFase}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis dataKey="fase" tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
              <Tooltip />
              <Bar dataKey="aantal" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Relaties per status</h2>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={relatiesByStatus} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                  {relatiesByStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground mb-4">Objecten per type vastgoed</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(objectenByType).map(([type, count]) => (
              <div key={type} className="bg-surface rounded-md p-3">
                <p className="text-sm capitalize text-foreground font-medium">{type}</p>
                <p className="text-2xl font-semibold font-mono-data text-foreground mt-1">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
