// Gedeelde types voor app-brede zoek/filter/sortering.

export interface SortOption<T> {
  /** Stabiele identifier, gebruikt voor persistentie in localStorage. */
  value: string;
  /** Weergavelabel in dropdown (NL). */
  label: string;
  /** Null-safe comparator: a vóór b → negatief. */
  compare: (a: T, b: T) => number;
}
