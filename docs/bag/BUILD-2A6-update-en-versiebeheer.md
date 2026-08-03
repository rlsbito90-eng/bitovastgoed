# BAG BUILD 2A.6 — update- en versiebeheer

## Uitkomst

BUILD 2A.6 is op 3 augustus 2026 groen uitgevoerd op de afgescheiden Lovable
Cloud-shadow `6a89a812-bc24-4545-8da4-dcf44e209fcf`. Productieproject
`ljudxyrqoifhfikueric` is niet benaderd of gewijzigd.

De build voegt twee private, `SECURITY INVOKER`-functies toe:

- `bag_control.activeer_datasetversie(bigint)`;
- `bag_control.rollback_datasetversie(bigint, bigint)`.

Alleen `bag_publisher` heeft uitvoerrecht. `anon`, `authenticated` en
`service_role` hebben dat niet.

## Activatiecontract

Activatie:

1. neemt een transactionele advisory lock per `scope_code`;
2. vergrendelt alle datasetversierijen van de scope in vaste ID-volgorde;
3. accepteert uitsluitend een gevalideerde, inactieve nieuwe versie;
4. vergelijkt objecten, voorkomens, relaties en geometrieën tussen staging en
   published;
5. weigert een lege object- of voorkomenlaag;
6. markeert de huidige actieve versie als `vervangen`;
7. activeert daarna exact de nieuwe versie in dezelfde transactie;
8. retourneert de expliciete voorganger voor een latere rollback.

De bestaande unieke partiële index op `scope_code WHERE is_actief` blijft de
laatste databasegarantie dat per scope nooit twee actieve versies bestaan.

## Rollbackcontract

Rollback accepteert uitsluitend een expliciet paar waarvan:

- de huidige versie actief is;
- de vorige versie vervangen en inactief is;
- beide versies exact dezelfde scope hebben.

Ook rollback gebruikt dezelfde scope-lock en voert de twee statuswijzigingen
atomisch uit. Een willekeurige oudere of scopevreemde versie kan daardoor niet
stil worden teruggezet.

## Uitgevoerde shadowproef

De transactionele proef heeft twee volledige synthetische versies A en B geladen
en gepubliceerd. Vervolgens is bewezen:

- activatie van A zonder voorganger;
- activatie van B met A als expliciete voorganger;
- A krijgt status `vervangen` en B wordt de enige actieve versie;
- rollback van B naar A;
- `bag_reader` ziet na rollback uitsluitend A;
- de volledige proef wordt teruggerold.

Eindstatus: `2A.6_VERSION_ACTIVATION_ROLLBACK_OK`.

## Eindcontrole

- nul BAG-testdata;
- nul blijvende `SET TRUE`-memberships;
- `bag_publisher` kan beide functies uitvoeren;
- app-rollen kunnen de functies niet uitvoeren.

## Vrijgave

De versie- en rollbackketen is groen. De landelijke vrijgave blijft afzonderlijk
geblokkeerd door de in BUILD 2A.5 gevonden ruimtelijke RLS/GiST-queryblocker.
Die blocker moet in BUILD 2A.7 door de gecontroleerde query-/servicelaag worden
opgelost en opnieuw op 100k-schaal worden gemeten.
