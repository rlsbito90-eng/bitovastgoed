interface NavItem {
  hash: string;
  label: string;
}

const ITEMS: NavItem[] = [
  { hash: 'off-market-bronnen', label: 'Off-market bronnen' },
  { hash: 'geo-verrijking', label: 'Geo-verrijking' },
  { hash: 'ai-achterstand', label: 'AI-achterstand' },
  { hash: 'bag-achterstand', label: 'BAG-achterstand' },
  { hash: 'afgekeurde-records', label: 'Afgekeurde records' },
  { hash: 'jaardoelen', label: 'Jaardoelen' },
  { hash: 'agenda-feed', label: 'Agenda-feed' },
  { hash: 'gebruikersbeheer', label: 'Gebruikersbeheer' },
];

interface Props {
  onJump: (hash: string) => void;
}

export default function AdminSectionNav({ onJump }: Props) {
  return (
    <nav
      aria-label="Beheer-secties"
      className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1"
      data-testid="admin-section-nav"
    >
      <span className="text-xs text-muted-foreground shrink-0 pr-1">Spring naar:</span>
      <div className="flex flex-wrap gap-1.5">
        {ITEMS.map(it => (
          <button
            key={it.hash}
            type="button"
            onClick={() => onJump(it.hash)}
            className="glass-chip text-xs px-2.5 py-1 rounded-full border border-border bg-card hover:bg-muted/60 text-foreground transition-colors whitespace-nowrap"
          >
            {it.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
