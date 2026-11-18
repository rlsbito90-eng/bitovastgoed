import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  /** Geen extra icoontjes die de waarde verdringen bij lange teksten. */
  multiline?: boolean;
}

/**
 * Het volledige getoonde veld is één toetsenbordvriendelijke actie.
 * Niet alleen een klein potloodje rechts. Enter/Spatie via native button,
 * focusindicator en mobiel voldoende aanraakruimte.
 *
 * Alleen gebruiken voor gewone dossierwaarden. Nooit voor acties met
 * juridische/transactieconsequenties of velden met interactieve kinderen.
 */
export default function EditableValueButton({
  label,children,onClick,disabled=false,className,multiline=false,
}:Props){
  return <button type="button"
    aria-label={`Wijzig ${label}`}
    title={`${label} wijzigen`}
    onClick={onClick} disabled={disabled}
    className={cn(
      'group/editvalue flex w-full min-h-10 min-w-0 items-center gap-2 rounded-md border border-transparent',
      'px-2 py-1.5 -mx-2 text-left transition-colors cursor-text',
      'hover:border-border/70 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
      'disabled:opacity-60 disabled:cursor-not-allowed',
      className,
    )}>
    <span className={cn(
      'min-w-0 flex-1 text-sm text-foreground break-words',
      multiline&&'whitespace-pre-wrap',
    )}>
      {children}
    </span>
    <Pencil aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 opacity-40 transition-opacity group-hover/editvalue:opacity-100 group-focus-visible/editvalue:opacity-100"/>
  </button>;
}
