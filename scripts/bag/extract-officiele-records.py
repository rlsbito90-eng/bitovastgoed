#!/usr/bin/env python3
"""Schrijf volledige officiële BAG-standrecords als NDJSON voor een read-only dry-run.

De bron-XML blijft lokaal in de workflow. Alleen één XML-record per NDJSON-regel wordt
naar de tijdelijke werkmap geschreven; dit bestand wordt niet als artifact gepubliceerd.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag.split(":")[-1]


def main() -> int:
    if len(sys.argv) != 3:
        print("Gebruik: extract-officiele-records.py <bronmap> <records.ndjson>", file=sys.stderr)
        return 2

    source = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    aantal = 0
    parse_fouten: list[str] = []

    with output.open("w", encoding="utf-8") as handle:
        for xml_path in sorted(source.rglob("*.xml")):
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
                            payload = ET.tostring(element, encoding="unicode")
                            handle.write(json.dumps({
                                "bronpad": str(xml_path.relative_to(source)),
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
                parse_fouten.append(f"{xml_path.relative_to(source)}: {exc}")

    samenvatting = output.with_suffix(".summary.json")
    samenvatting.write_text(json.dumps({
        "records": aantal,
        "parse_fouten": parse_fouten,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if parse_fouten:
        print(f"{len(parse_fouten)} XML-bestanden konden niet volledig worden gelezen.", file=sys.stderr)
        return 1
    if aantal == 0:
        print("Geen officiële BAG-standrecords aangetroffen.", file=sys.stderr)
        return 1

    print(f"{aantal} volledige officiële BAG-standrecords naar {output} geschreven.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
