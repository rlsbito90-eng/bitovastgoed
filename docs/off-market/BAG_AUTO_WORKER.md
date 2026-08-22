# BAG auto worker

De automatische BAG-worker verwerkt uitsluitend actieve Off-Market-signalen met `bag_status = niet_verrijkt` en `geo_status = verrijkt`.

- Batch: maximaal 15 per run.
- Resolver: `off-market-bag-verrijk` V2.6.
- Ambigue BAG-matches blijven `meerdere_matches`; er wordt niet gegokt.
- Geen AI-call.
- Geen automatische of betaalde Kadaster-call.
- De worker gebruikt dezelfde server-side cron-secret-auth als de overige workers.
