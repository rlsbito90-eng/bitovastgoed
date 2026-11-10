import { useState } from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { PASSKEY_ORIGIN, isPasskeyOriginAllowed } from '@/lib/auth/passkeyOrigin';

/** Beschikbaar in het gebruikersmenu voor een ingelogde CRM-beheerder. */
export default function PasskeySetupMenuItem() {
  const [bezig, setBezig] = useState(false);

  const registreer = async () => {
    if (bezig) return;
    if (!isPasskeyOriginAllowed(window.location.origin)) {
      toast.error('Registreer je passkey alleen op het vaste CRM-adres: bitovastgoed.vercel.app.');
      return;
    }
    if (!window.isSecureContext || !('PublicKeyCredential' in window)) {
      toast.error('Dit apparaat ondersteunt geen passkeys in deze browser.');
      return;
    }

    setBezig(true);
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) {
        if (error.code === 'passkey_disabled') {
          toast.error('Schakel eerst Passkeys in bij Supabase Authentication → Passkeys.');
        } else {
          toast.error('Passkey registreren mislukt. Probeer het opnieuw of controleer de Supabase-instellingen.');
        }
      } else {
        toast.success('Passkey geregistreerd. Je kunt Bito CRM nu ook in incognito met Touch ID openen.');
      }
    } catch {
      toast.error('Passkey registreren mislukt. Probeer het opnieuw.');
    } finally {
      setBezig(false);
    }
  };

  if (!isPasskeyOriginAllowed(window.location.origin)) {
    return (
      <DropdownMenuItem asChild>
        <a href={PASSKEY_ORIGIN} target="_blank" rel="noopener noreferrer">
          <Fingerprint className="mr-2 h-4 w-4" />
          Touch ID instellen via vaste CRM-adres
        </a>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem disabled={bezig} onSelect={() => { void registreer(); }}>
      {bezig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-2 h-4 w-4" />}
      Passkey / Touch ID instellen
    </DropdownMenuItem>
  );
}
