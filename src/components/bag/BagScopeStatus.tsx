import { Badge } from '@/components/ui/badge';
import {
  BAG_COMMERCIËLE_VOORKEURSCODE,
  BAG_SCOPE_REGISTER,
  BAG_TECHNISCHE_REFERENTIECODE,
  zoekBagScope,
} from '@/lib/bag/scopeRegistry';

interface Props {
  actieveScopeCode: string;
}

export default function BagScopeStatus({ actieveScopeCode }: Props) {
  const actief = zoekBagScope(actieveScopeCode);
  const voorkeur = zoekBagScope(BAG_COMMERCIËLE_VOORKEURSCODE);
  const referentie = zoekBagScope(BAG_TECHNISCHE_REFERENTIECODE);
  const gepland = BAG_SCOPE_REGISTER.filter(scope => scope.status === 'gepland');

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">Actieve BAG-regio</span>
        <Badge>{actief?.naam ?? actieveScopeCode}</Badge>
        <span className="text-[11px] text-muted-foreground">scope {actieveScopeCode}</span>
        {actief?.rol === 'technische_referentie' && (
          <Badge variant="secondary">Technische referentie</Badge>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-muted-foreground">Commerciële voorkeursregio:</span>
        <Badge variant="outline">{voorkeur?.naam ?? BAG_COMMERCIËLE_VOORKEURSCODE}</Badge>
        {actieveScopeCode !== BAG_COMMERCIËLE_VOORKEURSCODE && (
          <span className="text-muted-foreground">wordt actief na gevalideerde datasetimport en dubbele allowlist-activatie</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Gepland, nog niet geladen:</span>
        {gepland.map(scope => (
          <Badge key={scope.code} variant="outline" className="opacity-60">
            {scope.naam} · {scope.code}
          </Badge>
        ))}
      </div>

      {referentie && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {referentie.naam} blijft beschikbaar als technische referentie en is niet de commerciële acquisitiefocus.
        </p>
      )}
    </div>
  );
}
