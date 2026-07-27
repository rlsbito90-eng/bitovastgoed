# Vastgoedrekenen — propositiearchitectuur

De propositiebibliotheek is declaratief: definities beschrijven welke secties, ingrepen, bestemmingen, waarderingssporen en validaties bij een propositie horen. Daardoor blijft de rekenkern centraal en ontstaat geen verzameling losse calculators.

Sectorspecifieke modules zijn uitsluitend inputadapters. Zij valideren, normaliseren en beschrijven bronnen, maar berekenen geen investering, OVB, rendement, marge of residuele waarde. `computeScenario()` blijft de enige centrale financiële rekenkern.

Domeingrenzen:

- **Object** bezit feitelijke vastgoeddata, documenten en actuele contractinformatie.
- **Analysis** is één financiële beoordeling van een object op een bepaald moment.
- **Scenario** bezit aannames, strategie, kosten en toekomstige waarden.
- **CalculationSnapshot** legt objectfeiten, aannames, bronnen, engineversie en outputs onveranderlijk vast.
- **Deal** bezit het commerciële traject, partijen, biedingen, fee, deadlines en status.
- **DecisionSnapshot** verwijst naar de CalculationSnapshot die aan een besluit ten grondslag lag.

Backward compatibility wordt geborgd door ontbrekende of onbekende propositiewaarden als `legacy_generic` te behandelen en bestaande gecombineerde strategywaarden alleen via een adapter te interpreteren. Bestaande enums, opgeslagen scenario's en `computeScenario()` blijven ongewijzigd.

Buiten deze BUILD vallen databaseopslag, migraties, UI-wizards, dynamische secties, werkende sectorcalculaties, financiering, IRR/NCW, rapportage en historische herberekening.
