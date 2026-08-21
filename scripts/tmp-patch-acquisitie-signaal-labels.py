from pathlib import Path


def vervang(path: str, oud: str, nieuw: str) -> None:
    p = Path(path)
    tekst = p.read_text()
    if oud not in tekst:
        raise SystemExit(f'Patroon niet gevonden in {path}: {oud[:80]!r}')
    p.write_text(tekst.replace(oud, nieuw, 1))

for path in [
    'src/components/offmarket/acquisitie/AcquisitieSelectieTab.tsx',
    'src/components/offmarket/acquisitie/FocusModus.tsx',
]:
    vervang(
        path,
        "import {\n  SIGNAALTYPE_LABEL, type OffMarketSignaal,\n} from '@/lib/offMarket/types';",
        "import type { OffMarketSignaal } from '@/lib/offMarket/types';\nimport { acquisitieSignaalLabel } from '@/lib/offMarket/acquisitie/signaalLabel';",
    )
    vervang(
        path,
        "function tekstType(s: OffMarketSignaal): string {\n  return (SIGNAALTYPE_LABEL as Record<string, string>)[s.type_signaal] ?? s.type_signaal ?? '—';\n}",
        "function tekstType(s: OffMarketSignaal): string {\n  return acquisitieSignaalLabel(s);\n}",
    )

path = 'src/components/offmarket/acquisitie/VastgoedkansenInAcquisitieSelectie.tsx'
vervang(
    path,
    "import { PRIORITEIT_LABEL, STATUS_LABEL, kansTitel } from '@/lib/vastgoedkansen';",
    "import { HERKOMST_LABEL, PRIORITEIT_LABEL, STATUS_LABEL, kansTitel } from '@/lib/vastgoedkansen';",
)
vervang(
    path,
    "                  <Badge variant=\"outline\">{PRIORITEIT_LABEL[kans.prioriteit] ?? `P${kans.prioriteit}`}</Badge>",
    "                  <Badge variant=\"outline\">{PRIORITEIT_LABEL[kans.prioriteit] ?? `P${kans.prioriteit}`}</Badge>\n                  <Badge variant=\"outline\">\n                    {kans.herkomst === 'bag_selectie' ? 'Pandenverkenner' : HERKOMST_LABEL[kans.herkomst]}\n                  </Badge>",
)
