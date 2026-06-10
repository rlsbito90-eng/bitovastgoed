// Mapping van Kadaster Objectinformatie WOZ-object response naar
// view-vriendelijke velden voor de preview. Alle lookups zijn defensief:
// ontbrekende of afwijkende velden geven `null` terug en mogen niet crashen.

export interface WozObjectView {
  bag: {
    objectStatus: string | null;
    bouwjaar: number | null;
    oppervlakteBag: number | null;
    omschrijvingVergundeGebruik: string | null;
    complexrelatie: string | null;
    oppervlakteWijziging: string | null;
  };
  woz: Array<{
    wozObjectNummer: string | null;
    gebruiksklasse: string | null;
    feitelijkGebruik: string | null;
    monumentaanduiding: string | null;
    oppervlakteWoz: number | null;
    oppervlakteWozWonen: number | null;
    oppervlakteWozNietWonen: number | null;
    inhoud: number | null;
    bouwlaag: string | null;
  }>;
  algemeen: {
    actualiteit: string | null;
    doelbinding: string | null;
    titel: string | null;
  };
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'ja' : 'nee';
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function mapWozObject(data: unknown): WozObjectView {
  const root = asObj(data) ?? {};
  const bag = asObj(root.bagObjectData) ?? {};
  const wozLijstRaw = Array.isArray(root.wozObjecten) ? root.wozObjecten : [];

  return {
    bag: {
      objectStatus: asString(bag.objectStatus),
      bouwjaar: asNumber(bag.bouwjaar),
      oppervlakteBag: asNumber(bag.oppervlakteBag),
      omschrijvingVergundeGebruik: asString(bag.omschrijvingVergundeGebruik),
      complexrelatie: asString(bag.complexrelatie),
      oppervlakteWijziging: asString(bag.oppervlakteWijziging),
    },
    woz: wozLijstRaw.map((w) => {
      const wo = asObj(w) ?? {};
      return {
        wozObjectNummer: asString(wo.wozObjectNummer),
        gebruiksklasse: asString(wo.gebruiksklasse),
        feitelijkGebruik: asString(wo.feitelijkGebruik),
        monumentaanduiding: asString(wo.monumentaanduiding),
        oppervlakteWoz: asNumber(wo.oppervlakteWoz),
        oppervlakteWozWonen: asNumber(wo.oppervlakteWozWonen),
        oppervlakteWozNietWonen: asNumber(wo.oppervlakteWozNietWonen),
        inhoud: asNumber(wo.inhoud),
        bouwlaag: asString(wo.bouwlaag),
      };
    }),
    algemeen: {
      actualiteit: asString(root.actualiteit),
      doelbinding: asString(root.doelbinding),
      titel: asString(root.titel),
    },
  };
}

export function heeftWozObjectInhoud(view: WozObjectView): boolean {
  const b = view.bag;
  const heeftBag = !!(b.objectStatus || b.bouwjaar || b.oppervlakteBag
    || b.omschrijvingVergundeGebruik || b.complexrelatie || b.oppervlakteWijziging);
  const heeftWoz = view.woz.some((w) =>
    w.wozObjectNummer || w.gebruiksklasse || w.feitelijkGebruik
    || w.monumentaanduiding || w.oppervlakteWoz !== null
    || w.oppervlakteWozWonen !== null || w.oppervlakteWozNietWonen !== null
    || w.inhoud !== null || w.bouwlaag,
  );
  const heeftAlg = !!(view.algemeen.actualiteit || view.algemeen.doelbinding || view.algemeen.titel);
  return heeftBag || heeftWoz || heeftAlg;
}
