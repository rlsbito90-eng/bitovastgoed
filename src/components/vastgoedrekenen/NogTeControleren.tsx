import { AlertTriangle, Info, Ban } from 'lucide-react';
import type { ValidationItem } from '@/lib/vastgoedrekenen/validation';

export default function NogTeControleren({ items, title = 'Nog te controleren' }: { items: ValidationItem[]; title?: string }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((i, idx) => {
          const Icon = i.level === 'blocker' ? Ban : i.level === 'warning' ? AlertTriangle : Info;
          const color = i.level === 'blocker' ? 'text-destructive' : i.level === 'warning' ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground';
          return (
            <li key={idx} className={`flex gap-2 text-xs ${color}`}>
              <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{i.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
