import { LockKeyhole } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useKengetallenregister } from '@/hooks/useKengetallenregister';

export default function RegisterPackageLockSummary() {
  const { entries, loading } = useKengetallenregister();
  const locked = entries.filter((entry) => entry.bronpakket_locked);
  const packageNames = [...new Set(locked.map((entry) => entry.bronpakket_naam).filter((name): name is string => Boolean(name)))];

  if (loading) {
    return <p className="text-xs text-muted-foreground">Registervergrendelingen controleren…</p>;
  }

  if (locked.length === 0) return null;

  return (
    <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <LockKeyhole className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" />
        <span className="font-medium text-foreground">
          {locked.length} registerregel{locked.length === 1 ? '' : 's'} vergrendeld door goedgekeurde bronpakketten
        </span>
        {packageNames.map((name) => <Badge key={name} variant="outline">{name}</Badge>)}
      </div>
      <p className="mt-1">
        Bewerken, archiveren of verwijderen wordt zowel in de applicatie als in PostgreSQL geblokkeerd. Maak voor gewijzigde brondata een nieuwe pakketversie.
      </p>
    </div>
  );
}
