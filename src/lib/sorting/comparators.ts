// Null-safe basis-comparators. Nulls/undefined komen ALTIJD achteraan,
// ongeacht de sorteer-richting.

export type Dir = 'asc' | 'desc';

export function byString<T>(getter: (x: T) => string | null | undefined, dir: Dir = 'asc') {
  return (a: T, b: T) => {
    const av = getter(a);
    const bv = getter(b);
    const aEmpty = !av;
    const bEmpty = !bv;
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const r = (av as string).localeCompare(bv as string, 'nl', { sensitivity: 'base' });
    return dir === 'asc' ? r : -r;
  };
}

export function byNumber<T>(getter: (x: T) => number | null | undefined, dir: Dir = 'asc') {
  return (a: T, b: T) => {
    const av = getter(a);
    const bv = getter(b);
    const aEmpty = av == null || Number.isNaN(av);
    const bEmpty = bv == null || Number.isNaN(bv);
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  };
}

/** Vergelijk op datum (ISO string of YYYY-MM-DD). Lege waarden achteraan. */
export function byDate<T>(getter: (x: T) => string | null | undefined, dir: Dir = 'desc') {
  return (a: T, b: T) => {
    const av = getter(a);
    const bv = getter(b);
    const aEmpty = !av;
    const bEmpty = !bv;
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const at = new Date(av as string).getTime();
    const bt = new Date(bv as string).getTime();
    if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
    if (Number.isNaN(at)) return 1;
    if (Number.isNaN(bt)) return -1;
    return dir === 'asc' ? at - bt : bt - at;
  };
}

/** Combineer comparators: eerste die ≠ 0 retourneert wint. */
export function combine<T>(...cmps: Array<(a: T, b: T) => number>) {
  return (a: T, b: T) => {
    for (const c of cmps) {
      const r = c(a, b);
      if (r !== 0) return r;
    }
    return 0;
  };
}

/** Boolean-bucket — true eerst (of laatst). */
export function byBool<T>(getter: (x: T) => boolean, trueFirst = true) {
  return (a: T, b: T) => {
    const av = getter(a) ? 0 : 1;
    const bv = getter(b) ? 0 : 1;
    return trueFirst ? av - bv : bv - av;
  };
}
