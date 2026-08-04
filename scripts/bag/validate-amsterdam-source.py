#!/usr/bin/env python3
"""Valideer dat een uitgepakt officieel BAG-bronpakket plausibel Amsterdam (0363) bevat.

De validator schrijft uitsluitend een compact JSON-rapport. Hij wijzigt geen brondata en
maakt geen verbinding met Supabase.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

AMSTERDAM_SCOPE = "0363"
MIN_AMSTERDAM_AANDEEL = 0.90


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag.split(":")[-1]


def eerste_identificatie(xml: str) -> str | None:
    root = ET.fromstring(xml)
    for element in root.iter():
        if local_name(element.tag).lower() == "identificatie" and element.text:
            waarde = element.text.strip()
            if waarde:
                return waarde
    return None


def main() -> int:
    if len(sys.argv) != 3:
        print("Gebruik: validate-amsterdam-source.py <records.ndjson> <rapport.json>", file=sys.stderr)
        return 2

    records_path = Path(sys.argv[1])
    report_path = Path(sys.argv[2])
    prefixes: Counter[str] = Counter()
    zonder_identificatie = 0
    parse_fouten: list[str] = []
    totaal = 0

    with records_path.open("r", encoding="utf-8") as handle:
        for regelnummer, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            totaal += 1
            try:
                record = json.loads(line)
                identificatie = eerste_identificatie(record["xml"])
                if identificatie is None:
                    zonder_identificatie += 1
                else:
                    prefixes[identificatie[:4]] += 1
            except (KeyError, json.JSONDecodeError, ET.ParseError) as exc:
                parse_fouten.append(f"regel {regelnummer}: {exc}")

    met_identificatie = sum(prefixes.values())
    amsterdam = prefixes.get(AMSTERDAM_SCOPE, 0)
    aandeel = amsterdam / met_identificatie if met_identificatie else 0.0
    geldig = (
        totaal > 0
        and met_identificatie > 0
        and amsterdam > 0
        and aandeel >= MIN_AMSTERDAM_AANDEEL
        and not parse_fouten
    )

    rapport = {
        "scope_code": AMSTERDAM_SCOPE,
        "geldig": geldig,
        "totaal_records": totaal,
        "records_met_identificatie": met_identificatie,
        "records_zonder_identificatie": zonder_identificatie,
        "amsterdam_records": amsterdam,
        "amsterdam_aandeel": round(aandeel, 6),
        "minimum_aandeel": MIN_AMSTERDAM_AANDEEL,
        "prefix_tellingen": dict(sorted(prefixes.items())),
        "parse_fouten": parse_fouten,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(rapport, ensure_ascii=False))
    if not geldig:
        print("Bronpakket is niet veilig als Amsterdam-scope 0363 geaccepteerd.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
