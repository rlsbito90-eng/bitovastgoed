#!/usr/bin/env python3
"""Bouw een deterministisch bron- en chunkmanifest voor landelijke BAG-extractie.

De tool inspecteert XML-bestanden, ook in geneste ZIP-bestanden, en verdeelt ze
reproduceerbaar over maximaal acht chunks. De bronchecksum wordt streaming
berekend; er worden geen database- of netwerkaanroepen uitgevoerd.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

BUFFER_SIZE = 8 * 1024 * 1024


@dataclass(frozen=True)
class BronOnderdeel:
    bronpad: str
    compressed_bytes: int
    uncompressed_bytes: int
    crc32: str
    fingerprint: str


def streaming_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(BUFFER_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def _fingerprint(bronpad: str, compressed_bytes: int, uncompressed_bytes: int, crc: int) -> str:
    payload = f"{bronpad}\0{compressed_bytes}\0{uncompressed_bytes}\0{crc:08x}".encode()
    return hashlib.sha256(payload).hexdigest()


def _inspect_archive(archive: zipfile.ZipFile, bronpad: str = "") -> list[BronOnderdeel]:
    onderdelen: list[BronOnderdeel] = []
    for member in sorted(archive.infolist(), key=lambda item: item.filename):
        if member.is_dir():
            continue
        pad = f"{bronpad}!{member.filename}" if bronpad else member.filename
        lower = member.filename.lower()
        if lower.endswith(".xml"):
            onderdelen.append(
                BronOnderdeel(
                    bronpad=pad,
                    compressed_bytes=member.compress_size,
                    uncompressed_bytes=member.file_size,
                    crc32=f"{member.CRC:08x}",
                    fingerprint=_fingerprint(pad, member.compress_size, member.file_size, member.CRC),
                )
            )
        elif lower.endswith(".zip"):
            with tempfile.NamedTemporaryFile(suffix=".zip") as tijdelijk:
                with archive.open(member) as source:
                    shutil.copyfileobj(source, tijdelijk, length=BUFFER_SIZE)
                tijdelijk.flush()
                with zipfile.ZipFile(tijdelijk.name) as nested:
                    onderdelen.extend(_inspect_archive(nested, pad))
    return onderdelen


def inventariseer(source: Path) -> list[BronOnderdeel]:
    with zipfile.ZipFile(source) as archive:
        return _inspect_archive(archive)


def verdeel(onderdelen: Iterable[BronOnderdeel], chunk_count: int) -> list[dict]:
    if chunk_count < 1 or chunk_count > 8:
        raise ValueError("chunk_count moet tussen 1 en 8 liggen")

    buckets = [
        {"chunk_id": f"chunk-{index + 1:02d}", "uncompressed_bytes": 0, "onderdelen": []}
        for index in range(chunk_count)
    ]
    gesorteerd = sorted(onderdelen, key=lambda item: (-item.uncompressed_bytes, item.bronpad))
    for onderdeel in gesorteerd:
        bucket = min(buckets, key=lambda item: (item["uncompressed_bytes"], item["chunk_id"]))
        bucket["onderdelen"].append(onderdeel.bronpad)
        bucket["uncompressed_bytes"] += onderdeel.uncompressed_bytes

    for bucket in buckets:
        bucket["onderdelen"].sort()
        bucket["aantal_onderdelen"] = len(bucket["onderdelen"])
    return buckets


def bouw_manifest(source: Path, chunk_count: int) -> dict:
    onderdelen = inventariseer(source)
    chunks = verdeel(onderdelen, chunk_count)
    return {
        "schema_version": 1,
        "bronbestand": source.name,
        "bron_sha256": streaming_sha256(source),
        "bron_bytes": source.stat().st_size,
        "aantal_brononderdelen": len(onderdelen),
        "chunk_count": chunk_count,
        "onderdelen": [
            {
                "bronpad": item.bronpad,
                "compressed_bytes": item.compressed_bytes,
                "uncompressed_bytes": item.uncompressed_bytes,
                "crc32": item.crc32,
                "fingerprint": item.fingerprint,
            }
            for item in sorted(onderdelen, key=lambda item: item.bronpad)
        ],
        "chunks": chunks,
        "database_write_uitgevoerd": False,
        "supabase_benaderd": False,
        "productie_benaderd": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--chunks", type=int, default=8)
    args = parser.parse_args()

    if not args.source.is_file():
        parser.error(f"Bronbestand ontbreekt: {args.source}")

    manifest = bouw_manifest(args.source.resolve(), args.chunks)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "aantal_brononderdelen": manifest["aantal_brononderdelen"],
        "chunk_count": manifest["chunk_count"],
        "grootste_chunk_bytes": max((item["uncompressed_bytes"] for item in manifest["chunks"]), default=0),
        "kleinste_chunk_bytes": min((item["uncompressed_bytes"] for item in manifest["chunks"]), default=0),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
