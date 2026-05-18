// src/components/contactmoment/LogActionDropdown.tsx
import { useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  CONTACT_MOMENT_TYPE_LABELS, CONTACT_MOMENT_TYPE_ICON,
  type ContactMomentType,
} from '@/lib/contactMoments';
import ContactMomentFormDialog from '@/components/forms/ContactMomentFormDialog';

interface Props {
  relatieId?: string;
  objectId?: string;
  dealId?: string;
  acquisitieTargetId?: string;
  /** Compactere variant (alleen icon op klein scherm) */
  compact?: boolean;
}

const SNELLE_TYPES: ContactMomentType[] = ['telefoon', 'email', 'whatsapp', 'linkedin', 'afspraak', 'bezichtiging', 'notitie'];

export default function LogActionDropdown({ relatieId, objectId, dealId, acquisitieTargetId, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<ContactMomentType>('telefoon');

  const openWith = (type: ContactMomentType) => {
    setPreset(type);
    setOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className={compact ? 'sr-only sm:not-sr-only' : ''}>Log contact</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {SNELLE_TYPES.map(t => {
            const Icon = CONTACT_MOMENT_TYPE_ICON[t];
            return (
              <DropdownMenuItem key={t} onClick={() => openWith(t)}>
                <Icon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                {CONTACT_MOMENT_TYPE_LABELS[t]}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openWith('algemeen')}>
            <Plus className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            Aangepast…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ContactMomentFormDialog
        open={open}
        onOpenChange={setOpen}
        defaultType={preset}
        defaultRelatieId={relatieId}
        defaultObjectId={objectId}
        defaultDealId={dealId}
        defaultAcquisitieTargetId={acquisitieTargetId}
      />
    </>
  );
}
