// Compacte badge die toont dat een object voortkomt uit een off-market signaal.
import { Link } from 'react-router-dom';
import { Radar } from 'lucide-react';
import { useSignaalVoorObject } from '@/hooks/useOffMarketLinks';

interface Props {
  objectId: string;
}

export default function OffMarketOorsprongChip({ objectId }: Props) {
  const { data: signaal } = useSignaalVoorObject(objectId);
  if (!signaal) return null;

  return (
    <Link
      to={`/off-market/${signaal.id}`}
      className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-md border border-accent/30 bg-accent/10 text-accent-foreground hover:bg-accent/20 transition-colors"
      title={`Oorsprong: off-market signaal "${signaal.titel}"`}
    >
      <Radar className="h-3 w-3" />
      Oorsprong: Off-market signaal
    </Link>
  );
}
