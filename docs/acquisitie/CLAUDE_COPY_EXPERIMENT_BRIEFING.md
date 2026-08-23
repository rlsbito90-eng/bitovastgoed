# Claude Copy Experiment Briefing — Bito Vastgoed

## Doel

Gebruik Claude als specialistische copywriter binnen het acquisitie-experimentmodel van Bito CRM. Claude schrijft geen willekeurige alternatieven, maar challengers die één expliciete hypothese testen tegen een bestaande controlevariant.

## Experimentregels

1. Variant A blijft tijdens een lopende test ongewijzigd.
2. Variant B verandert één primaire copy-invalshoek.
3. Geen A/B/C/D tegelijk zonder expliciete reden; standaard A/B.
4. Geen claims verzinnen over concrete koperinteresse, vergunningstatus, eigendomssituatie of verkoopbereidheid.
5. Geen druk, misleiding of schaarste creëren die niet feitelijk onderbouwd is.
6. Discretie, professionaliteit en laagdrempelig contact blijven behouden.
7. De primaire KPI is kwalitatieve respons; totale respons is secundair.
8. De tekst moet geschikt blijven voor geautomatiseerde personalisatie met objectadres/plaats/geadresseerde.

## Bito-positionering

Bito Vastgoed begeleidt professionele beleggers, ontwikkelaars en vastgoedondernemers bij aan- en verkoop van residentieel en commercieel vastgoed, regelmatig in discrete/off-market trajecten.

Afzender:
- Ramysh Bito
- Eigenaar & Vastgoedadviseur
- Bito Vastgoed
- info@bitovastgoed.nl
- www.bitovastgoed.nl

## Eerste experiment

**Profiel:** Splitsingspotentie  
**Kanaal:** Post  
**Touchpoint:** Brief 1  
**Variant A:** bestaande controlebrief  
**Variant B:** challenger  
**Primaire hypothese:** een kortere en directere eerste brief, waarin sneller duidelijk wordt waarom juist dit object relevant is en waarin één eenvoudige CTA centraal staat, verhoogt de kwalitatieve respons ten opzichte van de huidige algemene controlebrief.

### Wat B bewust mag veranderen

- lengte en informatiedichtheid;
- volgorde van argumenten;
- snelheid waarmee het concrete object en de splitsings-/uitpondingsrelevantie worden benoemd;
- formulering van de CTA;
- mate van algemene bedrijfsuitleg.

### Wat B niet als extra variabele moet veranderen

- geen agressieve verkooptoon;
- geen andere doelgroep;
- geen fictieve koper of concrete bieding introduceren;
- geen urgentie/schaarste toevoegen;
- geen ander contactkanaal testen;
- geen tweede inhoudelijke hypothese tegelijk testen.

## Variant A — huidige controlebrief

Onderwerp: `Interesse in uw pand aan [OBJECTOMSCHRIJVING]`

```text
Geachte heer/mevrouw,

Mijn naam is Ramysh Bito, eigenaar van Bito Vastgoed. Vanuit mijn kantoor begeleid ik professionele beleggers, ontwikkelaars en vastgoedondernemers bij de aan- en verkoop van vastgoed, vaak in discrete trajecten buiten het openbare aanbod.

Ik neem contact met u op naar aanleiding van het vastgoed aan [OBJECTOMSCHRIJVING]. Binnen mijn netwerk is er regelmatig vraag naar vastgoed in deze omgeving, met name naar panden met beleggings-, verhuur-, splitsings-, transformatie- of ontwikkelpotentie.

Mocht u op dit moment, of wellicht op termijn, overwegen om dit pand, ander vastgoed of een bredere vastgoedportefeuille te verkopen, dan kom ik graag op een laagdrempelige manier met u in contact. Een eerste gesprek verplicht uiteraard tot niets en kan ook uitsluitend oriënterend zijn.

Bito Vastgoed werkt voornamelijk met professionele marktpartijen en begeleidt vastgoedtrajecten op een zorgvuldige en discrete manier. Indien verkoop voor u niet speelt, dan kunt u deze brief uiteraard als niet verzonden beschouwen. Mocht u echter openstaan voor een eerste kennismaking of marktverkenning, dan denk ik graag met u mee over de mogelijkheden.

Ik hoor graag of er vragen zijn of interesse is.

Met vriendelijke groet,

Ramysh Bito
Eigenaar & Vastgoedadviseur
Bito Vastgoed

T: +31 6 16 98 76 06
E: info@bitovastgoed.nl
W: www.bitovastgoed.nl
```

## Opdracht aan Claude

Je bent senior direct-response copywriter met ervaring in B2B-vastgoedacquisitie, leadgeneratie en gecontroleerde A/B-experimenten.

Beoordeel eerst kort de controlebrief A. Benoem alleen de 3–5 belangrijkste punten die mogelijk kwalitatieve respons beperken.

Schrijf daarna exact **één** challenger: **Variant B**.

Variant B moet:
- substantieel korter en directer zijn dan A;
- het concrete object vroeg benoemen;
- splitsings-/uitpondingsrelevantie specifiek maar voorzichtig benoemen;
- niet doen alsof de eigenaar wil verkopen;
- niet doen alsof er al een specifieke koper klaarstaat;
- professioneel en geloofwaardig zijn;
- menselijk klinken, niet als AI- of marketingcopy;
- één duidelijke, laagdrempelige CTA bevatten;
- in beginsel op één A4 passen inclusief adressering en handtekening;
- placeholders `[OBJECTOMSCHRIJVING]` en eventueel `[PLAATS]` gebruiken waar personalisatie nodig is.

Beoordeel de kwaliteit primair op de kans op een **bruikbare zakelijke reactie**, niet op creatieve schrijfstijl.

## Verplicht antwoordformat

### 1. Diagnose Variant A
- punt 1
- punt 2
- punt 3

### 2. Experimenthypothese
Eén zin: waarom B naar verwachting meer kwalitatieve respons kan opleveren dan A.

### 3. Variant B
**Onderwerp:** ...

```text
[volledige definitieve brief]
```

### 4. Wat is bewust anders dan A?
Noem maximaal 5 concrete verschillen. Alleen verschillen die bij de primaire hypothese horen.

### 5. Risico-check
Geef per item `OK` of `RISICO`:
- ongefundeerde koperclaim
- ongefundeerde verkoopaanname
- onnodige druk/urgentie
- te algemene boodschap
- te lange tekst
- CTA onduidelijk

### 6. Implementatieadvies
Geef alleen aan of de tekst `KLAAR VOOR A/B-TEST` is of `EERST AANPASSEN`, met maximaal 3 korte redenen.

## Vervolg nadat B is goedgekeurd

Na goedkeuring wordt Variant B als aparte, versievaste template geregistreerd onder:

`splitingspotentie:post:brief_1:B`

De CRM verdeelt nieuwe communicatie automatisch tussen A en B volgens de actieve experimentgewichten. Dezelfde communicatie houdt zijn eenmaal toegewezen variant. Resultaten worden centraal gevolgd in Conversie & experimenten volgens het Experiment Playbook.

> Let op: de canonieke profiel-key in de applicatie is `splitsingspotentie`. Bij implementatie moet de variant-key daarom exact `splitsingspotentie:post:brief_1:B` zijn.