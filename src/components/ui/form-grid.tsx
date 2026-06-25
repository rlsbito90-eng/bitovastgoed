import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Layout-wrappers voor formulieren volgens de Bito UI/UX-standaard.
 *
 * - `FormGrid`: mobiel 1 kolom, desktop 2 kolommen, consistente spacing.
 * - `FormRow`: volledige rij binnen een `FormGrid` (span 2 kolommen op desktop).
 *
 * Pure presentatie. Geen koppeling met react-hook-form of validatie.
 * Opt-in: bestaande formulieren worden NIET automatisch gemigreerd.
 */
interface FormGridProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function FormGrid({ className, children, ...rest }: FormGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface FormRowProps extends HTMLAttributes<HTMLDivElement> {
  /** Span volledige breedte (beide kolommen) op desktop. Default false. */
  full?: boolean;
  children: ReactNode;
}

export function FormRow({ className, full = false, children, ...rest }: FormRowProps) {
  return (
    <div
      className={cn(
        "min-w-0 space-y-1.5",
        full && "sm:col-span-2",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export default FormGrid;
