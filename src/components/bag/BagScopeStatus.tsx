import { Badge } from '@/components/ui/badge';
import { BAG_SCOPE_REGISTER, zoekBagScope } from '@/lib/bag/scopeRegistry';

interface Props {
  actieveScopeCode: string;
}

export default function BagScopeStatus({ actieveScopeCode }: Props) {
  const actief = zoekBagScope(actieveScopeCode);
  const gepland = BAG_SCOPE_REGISTER.filter(scope => scope.status === 'gepland');

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">Actieve BAG-regio</span>
        <Badge>{actief?.naam ?? actieveScopeCode}</Badge>
        <span className="text-[11px] text-muted-foreground">scope {actieveScopeCode}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Gepland, nog niet geladen:</span>
        {gepland.map(scope => (
          <Badge key={scope.code} variant="outline" className="opacity-60">
            {scope.naam} · {scope.code}
          </Badge>
        ))}
      </div>
    </div>
  );
}
