# BUILD 2A.1 — Officiële BAG Extract-mapping

## Herkomst

Deze mapping is gebaseerd op GitHub Actions-run `30768317953` op branch `feat/bag-build-2a1-volumeproef`, commit `b4e993b40d326966ebda7f61c7c17aac4e375b16`.

De workflow downloadde uitsluitend de officiële Kadaster-XSD-set en het officiële gemeenteproefbestand Assen (0106), controleerde beide ZIP-bestanden, pakte alle geneste ZIP-lagen recursief uit en publiceerde alleen inspectiemetadata.

## Gecontroleerde bronbestanden

- XSD-set SHA-256: `8c174dfca4f8dd436d6dc54e66e8cf6a0d3e73f7cd30929775e04353e351eed2`
- Assen-proefbestand SHA-256: `a821e6f63ca7767942f572315643174a07b175cd23e5d3abc7d95fb372bc33b6`

## Structuur

- 18 XSD-bestanden
- 45 XML-proefbestanden na recursief uitpakken
- 33 geneste ZIP-bestanden
- 96 uitgepakte bestanden totaal

De gemeentelevering bevat afzonderlijke bestandsfamilies voor:

- actieve BAG-objecten;
- objecten in onderzoek;
- inactieve objecten;
- niet-BAG-objecten;
- de Gemeente-Woonplaats-Relatietabel.

## Objectdekking in het proefbestand

| Objecttype | Aangetroffen elementen |
|---|---:|
| Ligplaats | 12 |
| Nummeraanduiding | 44.524 |
| OpenbareRuimte | 1.135 |
| Pand | 66.904 |
| Standplaats | 29 |
| Verblijfsobject | 55.436 |
| Woonplaats | 7 |

Alle zeven BAG-objecttypen zijn daadwerkelijk aangetroffen.

## Bevestigde namespaces

Onder meer zijn bevestigd:

- IMBAG objecten `v20200601`;
- IMBAG objectreferenties `v20200601`;
- IMBAG historie `v20200601`;
- kenmerken in onderzoek `v20200601`;
- BAG Extract-deelbestand en leveringsdocument `v20200601`;
- GWR-producten `v20200601`;
- GML `3.2`;
- XLink.

## Architectuurgevolg

De definitieve import mag niet één vlakke XML-stroom veronderstellen. De importorchestratie moet eerst de leveringscontainer inventariseren, daarna ZIP-lagen veilig en begrensd uitpakken, bestandsfamilies classificeren en vervolgens ieder XML-deelbestand streamend verwerken.

Historische en kwaliteitscategorieën mogen niet stil worden samengevoegd met actuele objecten. `actief`, `in_onderzoek`, `inactief` en `niet_bag` blijven als expliciete broncategorie beschikbaar voor validatie en publicatiebeleid.

## Nog niet bevestigd

De inspectierapporten bevatten geen volledige XML- of XSD-inhoud. Daardoor worden de exacte XPath-achtige veldpaden, voorkomenvelden, referentie-elementen en GML-geometrieconstructies pas definitief vastgelegd nadat een representatieve set officiële XML- en XSD-fragmenten veilig als kleine fixtures is geëxtraheerd.

Er is nog geen database-, Supabase-, CRM- of productie-import uitgevoerd.
