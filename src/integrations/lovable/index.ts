// Tijdelijke compatibiliteitsadapter voor bestaande imports.
// De runtime gebruikt uitsluitend native Supabase Auth; er is geen Lovable-authdependency meer.
// Hernoemen/verwijderen van dit pad kan apart nadat alle aanroepers zijn gemigreerd.

import { supabase } from '../supabase/client';

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

type OndersteundeProvider = 'google' | 'apple';

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: OndersteundeProvider, opts?: SignInOptions) => {
      return supabase.auth.signInWithOAuth({
        provider,
        options: {
          ...(opts?.redirect_uri ? { redirectTo: opts.redirect_uri } : {}),
          ...(opts?.extraParams ? { queryParams: opts.extraParams } : {}),
        },
      });
    },
  },
};
