#!/usr/bin/env python3
"""Schrijf reguliere officiële BAG-standrecords als NDJSON voor een read-only dry-run.

De bron-XML blijft lokaal in de workflow. Reguliere BAG-objectrecords worden naar het
tijdelijke NDJSON-bestand geschreven. De afzonderlijke InOnderzoek-bestanden behoren
tot een aanvullende berichtfamilie en worden apart geteld, niet als BAG-object geweigerd.
Het NDJSON-bestand wordt niet als artifact gepubliceerd.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag.split(":")[-1]


def is_in_onderzoek_bron(relatief_pad: Path) -> bool:
    return any("inonderzoek" in onderdeel.lower() for onderdeel in relatief_pad.parts)


def main() -> int:
    if len(sys.argv) != 3:
        print("Gebruik: extract-officiele-records.py <bronmap> <records.ndjson>", file=sys.stderr)
        return 2

    source = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    aantal = 0
    in_onderzoek_aantal = 0
    in_onderzoek_per_bron: Counter[str] = Counter()
    parse_fouten: list[str] = []

    with output.open("w", encoding="utf-8") as handle:
        for xml_path in sorted(source.rglob("*.xml")):
            relatief_pad = xml_path.relative_to(source)
            aanvullende_in_onderzoek_bron = is_in_onderzoek_bron(relatief_pad)

            try:
                in_stand = False
                stand_depth = 0

                for event, element in ET.iterparse(xml_path, events=("start", "end")):
                    naam = local_name(element.tag).lower()

                    if event == "start":
                        if in_stand:
                            stand_depth += 1
                        elif naam == "stand":
                            in_stand = True
                            stand_depth = 1
                        continue

                    if in_stand:
                        stand_depth -= 1
                        if stand_depth == 0:
                            if aanvullende_in_onderzoek_bron:
                                in_onderzoek_aantal += 1
                                in_onderzoek_per_bron[str(relatief_pad)] += 1
                            else:
                                payload = ET.tostring(element, encoding="unicode")
                                handle.write(json.dumps({
                                    "bronpad": str(relatief_pad),
                                    "xml": payload,
                                }, ensure_ascii=False) + "\n")
                                aantal += 1
                            in_stand = False
                            element.clear()
                        # Kinderen binnen een stand niet voortijdig wissen: anders
                        # blijft alleen een lege recordwrapper over.
                        continue

                    element.clear()
            except ET.ParseError as exc:
                parse_fouten.append(f"{relatief_pad}: {exc}")

    samenvatting = output.with_suffix(".summary.json")
    samenvatting.write_text(json.dumps({
        "reguliere_bag_objectrecords": aantal,
        "in_onderzoek_records": in_onderzoek_aantal,
        "in_onderzoek_per_bron": dict(sorted(in_onderzoek_per_bron.items())),
        "totaal_standrecords": aantal + in_onderzoek_aantal,
        "parse_fouten": parse_fouten,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if parse_fouten:
        print(f"{len(parse_fouten)} XML-bestanden konden niet volledig worden gelezen.", file=sys.stderr)
        return 1
    if aantal == 0:
        print("Geen reguliere officiële BAG-objectrecords aangetroffen.", file=sys.stderr)
        return 1

    print(
        f"{aantal} reguliere BAG-objectrecords naar {output} geschreven; "
        f"{in_onderzoek_aantal} InOnderzoek-records afzonderlijk geteld."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
