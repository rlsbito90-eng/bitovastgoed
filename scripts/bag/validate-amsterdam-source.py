#!/usr/bin/env python3
"""Valideer een richtinggevoelig Amsterdam/Weesp BAG-bronpakket.

De validator is conservatief: onverwachte Pand-prefixen of andere woonplaatsen maken de
bronrun NO-GO. Zo vereist ieder historisch/grensgeval expliciete beoordeling voordat een
nieuwe dataset kan worden geïmporteerd.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

AMSTERDAM_SCOPE = "0363"
TOEGESTANE_PAND_PREFIXES = {"0363", "0457"}
TOEGESTANE_WOONPLAATSEN = {"amsterdam", "weesp"}
OBJECTTYPEN = {
    "Pand", "Verblijfsobject", "Nummeraanduiding", "OpenbareRuimte",
    "Woonplaats", "Standplaats", "Ligplaats",
}


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag.split(":")[-1]


def record_info(xml: str) -> tuple[str, str | None, str | None]:
    root = ET.fromstring(xml)
    objecttype = "Onbekend"
    identificatie: str | None = None
    woonplaats_naam: str | None = None
    for element in root.iter():
        naam = local_name(element.tag)
        tekst = (element.text or "").strip()
        if objecttype == "Onbekend" and naam in OBJECTTYPEN:
            objecttype = naam
        if identificatie is None and naam.lower() == "identificatie" and tekst:
            identificatie = tekst
        if objecttype == "Woonplaats" and naam.lower() == "naam" and tekst:
            woonplaats_naam = tekst
    return objecttype, identificatie, woonplaats_naam


def main() -> int:
    if len(sys.argv) != 3:
        print("Gebruik: validate-amsterdam-source.py <records.ndjson> <rapport.json>", file=sys.stderr)
        return 2

    records_path = Path(sys.argv[1])
    report_path = Path(sys.argv[2])
    prefixes: Counter[str] = Counter()
    pand_prefixes: Counter[str] = Counter()
    woonplaatsen: Counter[str] = Counter()
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
                objecttype, identificatie, woonplaats_naam = record_info(record["xml"])
                if identificatie is None:
                    zonder_identificatie += 1
                else:
                    prefixes[identificatie[:4]] += 1
                    if objecttype == "Pand":
                        pand_prefixes[identificatie[:4]] += 1
                if objecttype == "Woonplaats" and woonplaats_naam:
                    woonplaatsen[woonplaats_naam.strip().casefold()] += 1
            except (KeyError, json.JSONDecodeError, ET.ParseError) as exc:
                parse_fouten.append(f"regel {regelnummer}: {exc}")

    onverwachte_pand_prefixes = {
        prefix: aantal
        for prefix, aantal in sorted(pand_prefixes.items())
        if prefix not in TOEGESTANE_PAND_PREFIXES
    }
    onverwachte_woonplaatsen = {
        naam: aantal
        for naam, aantal in sorted(woonplaatsen.items())
        if naam not in TOEGESTANE_WOONPLAATSEN
    }

    geldig = (
        totaal > 0
        and sum(pand_prefixes.values()) > 0
        and bool(woonplaatsen)
        and not onverwachte_pand_prefixes
        and not onverwachte_woonplaatsen
        and not parse_fouten
    )

    rapport = {
        "scope_code": AMSTERDAM_SCOPE,
        "geldig": geldig,
        "totaal_records": totaal,
        "records_zonder_identificatie": zonder_identificatie,
        "toegestane_pand_prefixes": sorted(TOEGESTANE_PAND_PREFIXES),
        "toegestane_woonplaatsen": sorted(TOEGESTANE_WOONPLAATSEN),
        "prefix_tellingen": dict(sorted(prefixes.items())),
        "pand_prefix_tellingen": dict(sorted(pand_prefixes.items())),
        "woonplaats_tellingen": dict(sorted(woonplaatsen.items())),
        "onverwachte_pand_prefixes": onverwachte_pand_prefixes,
        "onverwachte_woonplaatsen": onverwachte_woonplaatsen,
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
