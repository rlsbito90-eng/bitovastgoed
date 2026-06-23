// V1A — Compacte badge voor "in acquisitieselectie".
import { ListChecks } from 'lucide-react';

interface Props {
  className?: string;
  size?: 'sm' | 'md';
}

export default function InSelectieBadge({ className = '', size = 'sm' }: Props) {
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';
  return (
    <span
      data-testid="in-acquisitie-selectie-badge"
      className={`inline-flex items-center gap-1 ${padding} font-medium rounded-full border border-accent/40 bg-accent/10 text-accent whitespace-nowrap ${className}`}
      title="Dit signaal staat in de acquisitieselectie"
    >
      <ListChecks className="h-3 w-3" />
      In selectie
    </span>
  );
}
