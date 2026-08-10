import { createContext, useContext, type ReactNode } from 'react';

const KadasterAdresPreferenceContext = createContext<string | null>(null);

export function KadasterAdresPreferenceProvider({
  value,
  children,
}: {
  value: string | null;
  children: ReactNode;
}) {
  return (
    <KadasterAdresPreferenceContext.Provider value={value}>
      {children}
    </KadasterAdresPreferenceContext.Provider>
  );
}

export function useKadasterAdresPreference(): string | null {
  return useContext(KadasterAdresPreferenceContext);
}
