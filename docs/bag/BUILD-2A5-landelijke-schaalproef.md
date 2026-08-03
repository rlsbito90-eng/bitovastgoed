# BAG BUILD 2A.5 — landelijke schaalproxy op de shadow

## Uitkomst

De schaalproxy is op 3 augustus 2026 uitgevoerd op de afgescheiden Lovable
Cloud-remix `6a89a812-bc24-4545-8da4-dcf44e209fcf`. Productieproject
`ljudxyrqoifhfikueric` is niet benaderd of gewijzigd.

De laad-, publicatie- en cleanupketen is technisch geslaagd. De landelijke
vrijgave is bewust **geblokkeerd**, omdat de schaalproef aantoonde dat een
viewportquery onder de huidige geforceerde RLS-policy de GiST-index niet gebruikt.

## Beproefd volume

De deterministische proef bevatte zowel in staging als published exact:

- 100.000 objecten;
- 100.000 technische voorkomens;
- 100.000 relaties;
- 100.000 `PolygonZ`-geometrieën in EPSG:28992.

De volledige databaseketen bevatte tijdens de meting dus 800.001 BAG-rijen,
inclusief de datasetversie. De vier publishedlagen werden door de echte
`bag_publisher`-rol gevuld en waren uitsluitend via een actieve datasetversie
zichtbaar voor `bag_reader`.

## Metingen

| Meting | Resultaat | Plan |
|---|---:|---|
| Keyset vanaf pand-ID, limiet 100 | 4,053 ms | `Index Scan` op `bag_published_objecten_lookup_idx` |
| Brede viewport, limiet 2.500 | 7,693 ms | `Seq Scan`, stop na 2.500 resultaten |
| Smalle viewport, 121 resultaten | 31,593 ms | `Seq Scan`, alle 100.000 geometrieën gelezen |
| BAG-tabellen plus indexen tijdens proef | 242.270.208 bytes | staging + published |
| Totale database tijdens proef | 266.841.235 bytes | inclusief platformtabellen |

De opslag komt in deze vereenvoudigde synthetische proef neer op ongeveer
2,42 kB per logisch pandpakket: object, voorkomen, relatie en geometrie in zowel
staging als published. Dit is alleen een lineaire schaalindicator. De echte
landelijke XML-payload, historiediepte, relatiedichtheid en geometriecomplexiteit
kunnen substantieel afwijken.

## Gevonden blocker

De B-tree-keysetquery schaalt correct. De ruimtelijke filter staat onder de
RLS-policy echter als filter boven een sequentiële scan en niet als GiST
`Index Cond`. Vooral de smalle viewport bewijst het probleem: voor 121 resultaten
werden alle 100.000 geometrieën bekeken.

Een lineaire landelijke extrapolatie is daarom niet verantwoord. Eerst moet de
latere query-/servicelaag een gecontroleerde, indexbare ruimtelijke functie bieden
die uitsluitend de actieve dataset en een harde resultaatlimiet ontsluit. Daarna
wordt dezelfde 100k-proef herhaald; een smalle viewport moet dan aantoonbaar een
GiST-plan gebruiken.

## Connectorgedrag

Lovable beëindigde de HTTP-aanvragen voor de twee langlopende schrijffasen met
`499 request_cancelled`, terwijl PostgreSQL de transacties nog afrondde. De
uitvoering controleert daarom databaseactiviteit en tellingen afzonderlijk en
behandelt een HTTP-annulering nooit als bewijs van rollback of mislukking.

## Cleanup

Na de meting zijn alle synthetische rijen verwijderd, de drie tijdelijke
`SET TRUE`-memberships teruggezet naar hun oorspronkelijke `SET FALSE`-toestand
en de lege tabellen en indexen teruggebracht.

Eindcontrole:

- nul BAG-rijen;
- nul blijvende `SET TRUE`-memberships;
- BAG-tabellen en indexen samen: 466.944 bytes;
- totale shadowdatabase: 25.037.971 bytes.

## Besluit

BUILD 2A.5 bewijst de schrijf-, publicatie-, opslag- en keysetketen op 100k-schaal,
maar geeft nog geen landelijke go. De ruimtelijke RLS/index-blocker gaat als
verplichte acceptatiepoort mee naar de query-/servicelaag; productie blijft
volledig geblokkeerd.
