import { QueryClient } from '@tanstack/react-query';

/**
 * Gedeelde React Query-client voor de app en voor imperatieve services die
 * cache-invalidatie nodig hebben zonder zelf van een QueryClientProvider
 * afhankelijk te zijn.
 */
export const queryClient = new QueryClient();
