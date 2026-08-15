# BUILD O2 — Objecten / Vastgoedrekenen m²-bron

Doel: Vastgoedrekenen gebruikt dezelfde centrale assetclass-afhankelijke m²-bron als Financieel.

Wijziging:
- Vastgoedrekenen haalt het gekoppelde object via de bestaande data store op.
- `getBerekenM2Bron(object, object.type)` bepaalt de canonieke oppervlakte.
- Deze waarde wordt aan de bestaande Quickscan/Scenario-workspace doorgegeven.
- De eerder meegegeven `objectArea` blijft uitsluitend fallback als het object niet beschikbaar is.

Niet gewijzigd:
- financiële rekenformules;
- scenario-opslag;
- database/Supabase;
- `getBerekenM2Bron` zelf;
- matching of overige Objecten-tabs.
