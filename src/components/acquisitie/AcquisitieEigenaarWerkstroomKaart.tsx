import { ArrowRight, Landmark, Link2, Mail, Search, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AcquisitieEigenaarWerkstroomModel } from '@/lib/acquisitieEigenaarWerkstroom';

interface Props {
  model: AcquisitieEigenaarWerkstroomModel;
  onOpenOnderzoek?: () => void;
  onOpenEigenaarZoeken?: () => void;
  onOpenRelatieKoppelen?: () => void;
  onOpenBriefVoorbereiden?: () => void;
}

const STATUS_LABEL: Record<AcquisitieEigenaarWerkstroomModel['status'], string> = {
  niet_gestart: 'Niet gestart',
  onderzoek_lopend: 'Onderzoek loopt',
  gevonden: 'Eigenaar gevonden',
  benaderd: 'Eigenaar benaderd',
  onbekend: 'Onbekend',
};

export default function AcquisitieEigenaarWerkstroomKaart({
  model,
  onOpenOnderzoek,
  onOpenEigenaarZoeken,
  onOpenRelatieKoppelen,
  onOpenBriefVoorbereiden,
}: Props) {
  const primaireActie = !model.heeftEigenaar
    ? {
        label: model.kanEigenaarZoeken ? 'Start eigenaarsonderzoek' : 'Vul eerst een adres in',
        onClick: onOpenOnderzoek,
        disabled: !model.kanEigenaarZoeken || !onOpenOnderzoek,
        Icon: Search,
      }
    : !model.heeftRelatiekoppeling
      ? {
          label: 'Koppel eigenaar aan relatie',
          onClick: onOpenRelatieKoppelen,
          disabled: !model.kanRelatieKoppelen || !onOpenRelatieKoppelen,
          Icon: Link2,
        }
      : {
          label: 'Bereid brief voor',
          onClick: onOpenBriefVoorbereiden,
          disabled: !model.kanBriefVoorbereiden || !onOpenBriefVoorbereiden,
          Icon: Mail,
        };

  return (
    <section className="section-card p-4 sm:p-5" data-testid="acquisitie-eigenaar-werkstroom">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Kadaster & eigenaar</h2>
            <Badge variant="outline">{STATUS_LABEL[model.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Werk stap voor stap van pandonderzoek naar een gekoppelde eigenaar en gerichte benadering.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={primaireActie.onClick}
          disabled={primaireActie.disabled}
        >
          <primaireActie.Icon className="mr-1.5 h-4 w-4" />
          {primaireActie.label}
          {!primaireActie.disabled && <ArrowRight className="ml-1.5 h-4 w-4" />}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/15 p-3">
          <p className="text-xs text-muted-foreground">1. Pandonderzoek</p>
          <p className="mt-1 text-sm font-medium">
            {model.kadastraleAanduiding ? 'Kadastrale context bekend' : 'Nog te onderzoeken'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {model.laatstGecontroleerdOp
              ? `Laatst gecontroleerd: ${model.laatstGecontroleerdOp}`
              : 'Kadaster blijft handmatig; er wordt niets automatisch besteld.'}
          </p>
        </div>

        <div className="rounded-md border border-border bg-muted/15 p-3">
          <p className="text-xs text-muted-foreground">2. Eigenaar</p>
          <p className="mt-1 text-sm font-medium">
            {model.eigenaarNaam || (model.heeftRelatiekoppeling ? 'Via CRM-relatie bekend' : 'Nog niet gevonden')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {model.eigenaarBron ? `Bron: ${model.eigenaarBron}` : 'Leg bron en controleerdatum vast.'}
          </p>
        </div>

        <div className="rounded-md border border-border bg-muted/15 p-3">
          <p className="text-xs text-muted-foreground">3. CRM-koppeling</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
            <UserCheck className="h-4 w-4" />
            {model.heeftRelatiekoppeling ? 'Relatie gekoppeld' : 'Nog niet gekoppeld'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {model.heeftRelatiekoppeling
              ? 'Contactmomenten, taken en brieven kunnen in één dossier landen.'
              : 'Koppel pas nadat de eigenaar voldoende betrouwbaar is vastgesteld.'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {model.kanEigenaarZoeken && onOpenEigenaarZoeken && (
          <Button type="button" size="sm" variant="outline" onClick={onOpenEigenaarZoeken}>
            <Search className="mr-1.5 h-4 w-4" />Zoek eigenaar
          </Button>
        )}
        {model.kanRelatieKoppelen && onOpenRelatieKoppelen && (
          <Button type="button" size="sm" variant="outline" onClick={onOpenRelatieKoppelen}>
            <Link2 className="mr-1.5 h-4 w-4" />Relatie koppelen
          </Button>
        )}
        {model.kanBriefVoorbereiden && onOpenBriefVoorbereiden && (
          <Button type="button" size="sm" variant="outline" onClick={onOpenBriefVoorbereiden}>
            <Mail className="mr-1.5 h-4 w-4" />Brief voorbereiden
          </Button>
        )}
      </div>
    </section>
  );
}
