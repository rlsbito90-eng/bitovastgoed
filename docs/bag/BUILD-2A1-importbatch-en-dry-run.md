# BAG BUILD 2A.1-I — Importbatch en dry-runrapport

Deze stap voegt uitsluitend domeincontracten toe. Er worden geen bestanden naar Supabase geladen en er vinden geen database- of CRM-schrijfacties plaats.

## Contract

- positief geheel getal als batchgrootte;
- optionele startindex voor hervatten;
- deterministische batchgrenzen;
- checkpoint met cursor en verwerkt aantal;
- dry-runrapport met tellingen, waarschuwingen, fouten en fingerprint;
- fingerprint sluit tijdstempels uit en sorteert niet-semantische lijsten.

## Releasebetekenis

Een batchcheckpoint bewijst alleen dat een invoersegment technisch is verwerkt. Publicatie blijft geblokkeerd totdat de afzonderlijke kwaliteits- en release-gates slagen.
