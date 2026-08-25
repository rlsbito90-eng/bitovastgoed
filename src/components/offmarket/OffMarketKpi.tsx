import { Sparkles, AlertTriangle, Search, Phone, MessageCircle, Building2, Coins, MapPin } from 'lucide-react';
import { useOffMarketKpi, useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import { formatCurrency } from '@/lib/format/nl';
import { isBinnenAmsterdamRing } from '@/lib/offMarket/amsterdamRing';

interface TileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  onClick?: () => void;
}

function Tile({ icon: Icon, label, value, hint, onClick }: TileProps) {
  const cls = `rounded-lg border border-border/70 bg-card p-4 ${onClick ? 'cursor-pointer text-left transition-colors hover:border-accent/50 hover:bg-accent/5' : ''}`;
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className="mt-2 text-2xl font-semibold text-foreground font-mono-data">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </button>
    );
  }
  return (
    <div className={cls}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground font-mono-data">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export default function OffMarketKpi() {
  const { data, isLoading, error } = useOffMarketKpi();
  const { data: signalen = [] } = useOffMarketSignalen();
  const binnenRing = signalen.filter(isBinnenAmsterdamRing).length;

  const openBinnenRing = () => {
    try {
      sessionStorage.setItem('off-market-filter:tab', 'signalen');
      sessionStorage.setItem('off-market-filter:ring', 'binnen_ring');
    } catch {}
    window.location.reload();
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">KPI's laden…</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive">KPI's konden niet worden geladen.</p>;
  }
  const k = data!;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <Tile icon={Sparkles} label="Nieuw deze week" value={k.nieuwe_deze_week} />
      <Tile icon={MapPin} label="Binnen ring" value={binnenRing} hint="Amsterdam · binnen A10, excl. Noord" onClick={openBinnenRing} />
      <Tile icon={AlertTriangle} label="Hoge prioriteit" value={k.hoge_prioriteit} hint="Hoog + Urgent" />
      <Tile icon={Search} label="Te onderzoeken" value={k.te_onderzoeken} />
      <Tile icon={Phone} label="Eigenaar achterhalen" value={k.eigenaren_te_benaderen} />
      <Tile icon={MessageCircle} label="In gesprek" value={k.in_gesprek} />
      <Tile icon={Building2} label="Objecten ontvangen" value={k.objecten_ontvangen} />
      <Tile icon={Coins} label="Fee-pipeline" value={formatCurrency(Number(k.fee_pipeline) || 0)} hint="Som mogelijke fee" />
    </div>
  );
}
