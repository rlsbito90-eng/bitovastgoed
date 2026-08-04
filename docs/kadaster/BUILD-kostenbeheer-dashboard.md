# BUILD — Kadasterkostenbeheer en rapportage

## Resultaat

Deze BUILD maakt het kostenfundament zichtbaar en persistent voorbereid:

- productcatalogus voor gratis en betaalde Kadasterproducten;
- configureerbare bedrijfs-, gebruikers- en campagnebudgetten;
- auditbare kosten-events met geraamde en werkelijke kosten;
- week-, maand- en jaaroverzicht;
- aantallen aanvragen, eenheden en kosten per product;
- laatste-aanvragenregister;
- beheerbare daglimiet, maandlimiet, bevestigingsgrens en harde blokkade;
- beheerderoverride blijft mogelijk;
- producttarief en activatie zijn handmatig beheerbaar.

## Veiligheidsgrens

- geen Kadaster-API-call;
- geen API-key of secret;
- geen automatische betaalde aanvraag;
- betaalde producten zijn standaard inactief;
- tarieven zijn niet hardgecodeerd;
- browserrollen kunnen kosten-events alleen lezen;
- toekomstige kosten-events worden uitsluitend via een beveiligde servergateway geschreven;
- migratie is alleen aan de repository toegevoegd en nog niet toegepast op productie.

## Route

`/rapportage/kadasterkosten`

Wanneer de migratie nog niet is toegepast toont de pagina een expliciete niet-actiefmelding en maakt zij geen kosten.

## Vervolg

1. migratie gecontroleerd toepassen en Supabase-types regenereren;
2. route vanuit Rapportage/Admin zichtbaar maken;
3. beveiligde servergateway bouwen;
4. gratis Objectinformatie-proef uitvoeren;
5. pas daarna afzonderlijke betaalde productproeven met expliciete kostenbevestiging.
