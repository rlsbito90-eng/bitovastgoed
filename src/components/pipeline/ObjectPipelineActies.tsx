import { MessageSquareText, MoreHorizontal, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  canAdd: boolean;
  onAdd: () => void;
  onOffer: () => void;
  onReply: () => void;
}

/**
 * Eén zichtbare primaire kandidaat-actie; de registratiehandelingen staan
 * compact in Meer. Het bestaande aanbod-/reactiedialoog en de pipeline-
 * registratie worden door de bovenliggende component ongewijzigd gebruikt.
 */
export default function ObjectPipelineActies({canAdd,onAdd,onOffer,onReply}:Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" onClick={onAdd} disabled={!canAdd} className="gap-1.5">
        <Plus className="h-4 w-4" /> Kandidaat toevoegen
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" aria-label="Meer kandidaat-acties" className="gap-1.5">
            <MoreHorizontal className="h-4 w-4" /> Meer
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[240px]">
          <DropdownMenuItem onSelect={onOffer} className="gap-2">
            <Send className="h-4 w-4 shrink-0" />
            <span>Aanbieding registreren</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onReply} className="gap-2">
            <MessageSquareText className="h-4 w-4 shrink-0" />
            <span>Reactie registreren</span>
          </DropdownMenuItem>
          <div className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
            Registreren legt bestaande communicatie vast; er wordt niets verzonden.
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
