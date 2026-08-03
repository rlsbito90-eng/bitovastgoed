# BAG BUILD 2A.7 — private query-/servicelaag

## Uitkomst

BUILD 2A.7 is op 3 augustus 2026 uitgevoerd op de afgescheiden Lovable
Cloud-shadow `6a89a812-bc24-4545-8da4-dcf44e209fcf`. Productieproject
`ljudxyrqoifhfikueric` is niet benaderd of gewijzigd.

De in BUILD 2A.5 gevonden RLS/GiST-blocker is opgelost via een private,
begrensde `bag_service`-laag. De oorspronkelijke BAG-tabellen blijven met
geforceerde RLS afgesloten; app-rollen krijgen geen directe of indirecte toegang.

## Servicegrens

De database biedt uitsluitend aan `bag_reader`:

- `bag_service.panden_in_viewport(...)` met RD New-bounds en maximaal 2.500
  resultaten;
- `bag_service.zoek_panden(...)` met keysetpaginering en maximaal 250 resultaten.

Beide functies:

- gebruiken vaste SQL zonder dynamische fragmenten;
- hebben een vastgezette `search_path`;
- draaien als `SECURITY DEFINER` onder de bestaande `postgres`-owner met
  `BYPASSRLS`;
- selecteren uitsluitend de actieve dataset van de opgegeven scope;
- valideren scope, limieten en coördinaten opnieuw in PostgreSQL;
- zijn niet uitvoerbaar door `anon`, `authenticated` of `service_role`.

De browser krijgt dus geen BAG-schema of RPC-recht. Een latere transportadapter
moet de private readerverbinding server-side gebruiken.

## 100k-herhaalmeting

De volledige 2A.5-schaalproxy is opnieuw geladen en gepubliceerd:

- 100.000 objecten;
- 100.000 voorkomens;
- 100.000 relaties;
- 100.000 `PolygonZ`-geometrieën;
- zowel staging als published.

De eerder falende smalle viewport leverde 121 panden. Het vaste interne
serviceplan gebruikte nu aantoonbaar:

- `Index Scan` op `bag_published_geometrieen_gist_idx`;
- 121 indextreffers;
- 0 door filter verwijderde rijen;
- 5,455 ms uitvoering inclusief GeoJSON- en afkappingslogica.

Ter vergelijking: dezelfde smalle viewport onder directe `bag_reader`-RLS las in
BUILD 2A.5 alle 100.000 geometrieën via `Seq Scan` en kostte 31,593 ms.

## Functiemetingen

| Meting | Resultaat |
|---|---:|
| Smalle viewport via private functie | 121 rijen; 160–272 ms per nieuwe connectorsessie |
| Brede viewport via private functie | exact 2.500 rijen; 82,157 ms |
| Brede viewport afkappingsvlag | `true` |
| Keysetzoekpagina | 100 rijen; 12,684 ms |

De functie-aanroep bevat per nieuwe connectorsessie ook PostgreSQL-planning en
GeoJSON-serialisatie. De interne ruimtelijke uitvoering zelf is indexbaar en ruim
onder de proefgrens. Voor een productie-SLA zijn later meerdere koude en warme
runs via de echte transportadapter nodig.

## Aanvullende index

Voor objectgerichte geometrie-opvragingen is toegevoegd:

`(datasetversie_id, objecttype, identificatie, geometrie_volgnummer)`.

De bestaande GiST-index blijft de bron voor viewportselectie.

## Securitybewijs

- `bag_reader`: schema-USAGE en functie-EXECUTE;
- `anon`: geen toegang;
- `authenticated`: geen toegang;
- `service_role`: geen toegang;
- alle BAG-brontabellen behouden geforceerde RLS.

## Cleanup

Na de herhaalmeting:

- nul BAG-rijen;
- nul `SET TRUE`-memberships;
- nul door de proef achtergelaten grants met `postgres` als grantor;
- de oorspronkelijke drie `supabase_admin`/`SET FALSE`-memberships exact behouden;
- BAG-tabellen en indexen samen circa 475 kB;
- totale shadowdatabase circa 25,1 MB.

## Vrijgave

De ruimtelijke schaalblocker uit BUILD 2A.5 is technisch opgelost. BUILD 2A.8
moet nu de centrale preflight samenstellen die schema, privileges, actieve versie,
querylimieten, indexplan en productieblokkade in één vrijgavebesluit combineert.
