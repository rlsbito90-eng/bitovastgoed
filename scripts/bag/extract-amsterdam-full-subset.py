#!/usr/bin/env python3
"""Schrijf de volledige XML-records van de Amsterdam-closure uit de officiële landelijke bron.

Dit script downloadt niets. Het bronbestand en de uitgepakte XML-map zijn expliciete
invoer. De sha256 van het bronbestand wordt exact afgedwongen; bij afwijking, bij een
parsefout of bij 0 geselecteerde Amsterdamrecords faalt het script fail-closed.

Gebruik:
  extract-amsterdam-full-subset.py <bronbestand> <uitgepakte-map> <closure.json> <output.ndjson>
                                   [--verwachte-hash <sha256>]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

VERWACHTE_BRON_SHA256 = "fe2c5b7d7a264dd74ca7bfee72e7edd07d43dd99a90a34c8317e21ab6d79335c"


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag.split(":")[-1]


def bestand_sha256(pad: Path) -> str:
    digest = hashlib.sha256()
    with pad.open("rb") as handle:
        for blok in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(blok)
    return digest.hexdigest()


def is_in_onderzoek_bron(relatief_pad: Path) -> bool:
    return any("inonderzoek" in onderdeel.lower() for onderdeel in relatief_pad.parts)


def record_identificatie(element: ET.Element) -> tuple[str | None, str | None]:
    """Geeft (objecttype, identificatie) van een standrecord terug."""
    objecttype = None
    identificatie = None
    for kind in element.iter():
        naam = local_name(kind.tag)
        if objecttype is None and naam in {
            "Pand",
            "Verblijfsobject",
            "Nummeraanduiding",
            "OpenbareRuimte",
            "Woonplaats",
            "Standplaats",
            "Ligplaats",
        }:
            objecttype = naam
        if identificatie is None and naam == "identificatie" and (kind.text or "").strip():
            identificatie = (kind.text or "").strip()
        if objecttype and identificatie:
            break
    return objecttype, identificatie


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("bronbestand")
    parser.add_argument("uitgepakte_map")
    parser.add_argument("closure")
    parser.add_argument("output")
    parser.add_argument("--verwachte-hash", default=VERWACHTE_BRON_SHA256)
    args = parser.parse_args()

    bronbestand = Path(args.bronbestand).resolve()
    bronmap = Path(args.uitgepakte_map).resolve()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    bewijs_pad = output.with_suffix(".bewijs.json")

    def faal(code: str, reden: str, bewijs: dict | None = None) -> int:
        payload = {"status": "stop", "code": code, "reden": reden}
        if bewijs:
            payload.update(bewijs)
        bewijs_pad.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"STOP {code}: {reden}", file=sys.stderr)
        return 1

    if not bronbestand.is_file():
        return faal("bron_ontbreekt", f"Bronbestand {bronbestand} bestaat niet.")

    gemeten = bestand_sha256(bronbestand)
    if gemeten != args.verwachte_hash:
        return faal(
            "bron_hash_drift",
            f"bron_sha256 {gemeten} wijkt af van {args.verwachte_hash}.",
            {"bron_sha256_gemeten": gemeten, "bron_sha256_verwacht": args.verwachte_hash},
        )

    closure = json.loads(Path(args.closure).read_text(encoding="utf-8"))
    if closure.get("status") not in {None, "closure_validated"}:
        return faal("closure_niet_gevalideerd", f"Closurestatus {closure.get('status')}.")
    rapport = closure.get("rapport", closure)
    selectie = set(rapport.get("geselecteerdeIds") or [])
    if not selectie:
        return faal("lege_selectie", "Closurerapport bevat geen geselecteerde identificaties.")

    objecttypen: Counter[str] = Counter()
    prefixverdeling: Counter[str] = Counter()
    parse_fouten: list[str] = []
    gelezen = 0
    geschreven = 0
    overgeslagen_in_onderzoek = 0
    zonder_identificatie = 0

    with output.open("w", encoding="utf-8") as handle:
        for xml_path in sorted(bronmap.rglob("*.xml")):
            relatief_pad = xml_path.relative_to(bronmap)
            if is_in_onderzoek_bron(relatief_pad):
                continue
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
                            gelezen += 1
                            objecttype, identificatie = record_identificatie(element)
                            if identificatie is None:
                                zonder_identificatie += 1
                            elif identificatie in selectie:
                                handle.write(
                                    json.dumps(
                                        {
                                            "bronpad": str(relatief_pad),
                                            "xml": ET.tostring(element, encoding="unicode"),
                                        },
                                        ensure_ascii=False,
                                    )
                                    + "\n"
                                )
                                geschreven += 1
                                objecttypen[objecttype or "onbekend"] += 1
                                prefixverdeling[identificatie[:4]] += 1
                            in_stand = False
                            element.clear()
                        continue
                    element.clear()
            except ET.ParseError as exc:
                parse_fouten.append(f"{relatief_pad}: {exc}")

    bewijs = {
        "status": "full_subset_validated",
        "bron_sha256": gemeten,
        "bronbestand": bronbestand.name,
        "selectie_checksum": rapport.get("selectieChecksum"),
        "geselecteerd_aantal": len(selectie),
        "standrecords_gelezen": gelezen,
        "records_geschreven": geschreven,
        "records_zonder_identificatie": zonder_identificatie,
        "in_onderzoek_bronnen_overgeslagen": overgeslagen_in_onderzoek,
        "objecttypen": dict(sorted(objecttypen.items())),
        "prefixverdeling": dict(sorted(prefixverdeling.items())),
        "parse_fouten": parse_fouten,
        "output_sha256": bestand_sha256(output),
        "output_bytes": output.stat().st_size,
    }

    if parse_fouten:
        bewijs["status"] = "stop"
        bewijs["code"] = "parsefout"
        bewijs_pad.write_text(json.dumps(bewijs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"STOP parsefout: {len(parse_fouten)} XML-bestanden onleesbaar.", file=sys.stderr)
        return 1

    if geschreven == 0:
        bewijs["status"] = "stop"
        bewijs["code"] = "geen_amsterdamrecords"
        bewijs_pad.write_text(json.dumps(bewijs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("STOP geen_amsterdamrecords: 0 geselecteerde records geschreven.", file=sys.stderr)
        return 1

    bewijs_pad.write_text(json.dumps(bewijs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{geschreven} van {len(selectie)} geselecteerde records naar {output} geschreven.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
