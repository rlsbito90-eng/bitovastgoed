# BUILD 1A.4 — Amsterdam-v3 bronselectie voor pand_search_index

Status: read-only voorbereid

Project: `xfygspvpeugxowxbcvnm`
Scope: `0363`
Actieve dataset: `v20260808-directional-v3`

## Read-only bronstatistieken

- Pandobjecten: 211.112
- Verblijfsobjecten: 630.005
- Panden met ten minste één gekoppeld VBO: 143.988
- Panden zonder gekoppeld VBO: 67.124
- Actuele Pand-voorkomens (`is_actueel=true`): 211.129
- Panden met meer dan één actueel Pand-voorkomen: 16
- Extra actuele voorkomens boven één per pand: 17
- Maximum actuele voorkomens voor één pand: 3

## Belangrijk bronverschijnsel

`is_actueel=true` is in de actieve Amsterdam-v3 dataset niet voldoende om één actueel voorkomen per Pand te garanderen. Een indexbuild die rechtstreeks alle actuele voorkomens zou joinen kan daarom dubbele pandrijen of conflicterende status/bouwjaarkeuzes opleveren.

## Deterministische selectie kandidaat

Per Pand wordt uit de `is_actueel=true` voorkomens exact één winnaar gekozen op:

1. `begin_geldigheid DESC NULLS LAST`
2. `tijdstipRegistratie DESC`
3. `voorkomen_sleutel DESC`

Read-only bewijs op Amsterdam-v3:

- gekozen winnaars: 211.112
- unieke pandidentificaties: 211.112

De regel lost dus de 16 meervoudige actuele groepen deterministisch op zonder panden te verliezen.

## Architectuurregel

De zoekindex representeert één operationele zoekrij per Pandobject. De onderliggende BAG-voorkomens blijven volledig behouden in `bag_published`; de selectie hierboven is uitsluitend een deterministic read-modelkeuze en wijzigt geen brondata.

## Nog te bewijzen vóór echte build

- VBO-aggregatie gebruikt eveneens deterministisch actuele VBO-voorkomens;
- oppervlakte-som en -max behandelen ontbrekende/ongeldige oppervlakte correct;
- primaire adreskeuze is deterministisch over alle gekoppelde VBO-adressen;
- pandgeometrie wordt deterministisch aan het gekozen Pand-voorkomen gekoppeld;
- indexbuild levert exact 211.112 rijen;
- exact 67.124 rijen hebben `heeft_vbo=false` en NULL-oppervlakten, tenzij verdere geldigheidsfiltering op actuele VBO's dit aantoonbaar wijzigt.

## Veiligheidsstatus

Geen indexrij geschreven. Geen wijziging aan `bag_published`, `bag_control`, CRM of Edge Functions.
