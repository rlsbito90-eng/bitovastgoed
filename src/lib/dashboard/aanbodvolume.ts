export interface AanbodObject {
  id: string;
  vraagprijs?: number | null;
  parentObjectId?: string | null;
}

export interface Aanbodvolume {
  /** Som van bekende vraagprijzen, zonder dubbeltellingen. */
  totaal: number;
  /** Aantal posten (losse objecten of portefeuilles) zonder bekende vraagprijs. */
  zonderVraagprijs: number;
}

const bekend = (prijs: number | null | undefined): prijs is number => typeof prijs === 'number' && prijs > 0;

/**
 * Actief aanbodvolume: som van bekende vraagprijzen van actieve objecten, zonder dubbeltellingen.
 *
 * Portefeuilles (ouder met deelobjecten in dezelfde actieve set):
 * - heeft de ouder een vraagprijs, dan telt alleen die; deelobjecten tellen niet apart mee;
 * - heeft de ouder geen vraagprijs, dan tellen de bekende prijzen van de deelobjecten; deelobjecten
 *   zonder prijs tellen als onbekend; zonder enige bekende prijs telt de portefeuille als één onbekende post.
 * Een deelobject waarvan de ouder niet in de actieve set zit, telt als los object.
 */
export function berekenAanbodvolume(objecten: AanbodObject[]): Aanbodvolume {
  const ids = new Set(objecten.map(o => o.id));
  const kinderen = new Map<string, AanbodObject[]>();
  for (const o of objecten) {
    if (o.parentObjectId && ids.has(o.parentObjectId)) {
      kinderen.set(o.parentObjectId, [...(kinderen.get(o.parentObjectId) ?? []), o]);
    }
  }

  let totaal = 0;
  let zonderVraagprijs = 0;
  for (const o of objecten) {
    const isDeelVanActieveOuder = !!o.parentObjectId && ids.has(o.parentObjectId);
    if (isDeelVanActieveOuder) continue; // telt mee via de ouder

    const deel = kinderen.get(o.id) ?? [];
    if (bekend(o.vraagprijs)) {
      totaal += o.vraagprijs;
      continue;
    }
    if (deel.length === 0) {
      zonderVraagprijs += 1;
      continue;
    }
    const geprijsd = deel.filter(k => bekend(k.vraagprijs));
    if (geprijsd.length === 0) {
      zonderVraagprijs += 1;
      continue;
    }
    totaal += geprijsd.reduce((som, k) => som + (k.vraagprijs as number), 0);
    zonderVraagprijs += deel.length - geprijsd.length;
  }
  return { totaal, zonderVraagprijs };
}
