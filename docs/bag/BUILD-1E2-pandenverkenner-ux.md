# BUILD 1E.2 — Pandenverkenner UX-herindeling

Doel: de Pandenverkenner op mobiel en desktop rustiger en taakgerichter maken zonder BAG-querylogica, indexdata, selectiepreflight of handmatige promotie te wijzigen.

Wijzigingen:
- aparte weergaven `Zoeken & lijst` en `Kaart`;
- kaart niet langer inline onder het volledige filterpaneel;
- uitgebreide filters standaard ingeklapt achter `Meer filters`;
- basisfilters (bouwjaar, VBO-modus, gemengd) direct zichtbaar;
- filterstate blijft in dezelfde component behouden bij wisselen van weergave;
- Vastgoedkansen-header: `Nieuwe kans` links/secundair en `Panden vinden` rechts/primair.

Veiligheidsgrenzen:
- geen Supabase-migratie;
- geen Edge Function-wijziging;
- geen BAG-indexwrite;
- geen Kadasteractie;
- geen wijziging aan CRM-promotie- of preflightlogica.
