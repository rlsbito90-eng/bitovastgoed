import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { lovable } from '@/integrations/lovable';

async function handleGoogleSignIn() {
  const result = await lovable.auth.signInWithOAuth('google', {
    redirect_uri: window.location.origin,
  });
  if (result.error) {
    toast.error('Inloggen met Google mislukt');
  }
}

const GoogleButton = () => (
  <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn}>
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.48 12c0-.73.13-1.44.36-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
    Doorgaan met Google
  </Button>
);

async function handleAppleSignIn() {
  const result = await lovable.auth.signInWithOAuth('apple', {
    redirect_uri: window.location.origin,
  });
  if (result.error) {
    toast.error('Inloggen met Apple mislukt');
  }
}

const AppleButton = () => (
  <Button type="button" variant="outline" className="w-full" onClick={handleAppleSignIn}>
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.46 2.23-1.2 3.02-.8.86-2.1 1.52-3.18 1.43-.14-1.1.43-2.24 1.15-3.02.8-.87 2.18-1.52 3.23-1.43zM20.5 17.27c-.55 1.27-.82 1.84-1.53 2.97-1 1.57-2.4 3.53-4.14 3.55-1.55.02-1.95-1.01-4.05-1-2.1.01-2.54 1.02-4.09 1-1.74-.02-3.07-1.79-4.07-3.36-2.8-4.4-3.1-9.56-1.37-12.3 1.23-1.96 3.17-3.1 5-3.1 1.86 0 3.03 1.02 4.56 1.02 1.49 0 2.4-1.02 4.55-1.02 1.62 0 3.34.88 4.56 2.4-4.01 2.2-3.36 7.93.58 9.84z"/>
    </svg>
    Doorgaan met Apple
  </Button>
);

export default function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [bezig, setBezig] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginWw, setLoginWw] = useState('');

  // Signup state
  const [naam, setNaam] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupWw, setSignupWw] = useState('');

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBezig(true);
    const { error } = await signIn(loginEmail, loginWw);
    setBezig(false);
    if (error) {
      toast.error(error.message === 'Invalid login credentials' ? 'Ongeldige inloggegevens' : 'Inloggen mislukt. Controleer je gegevens.');
    } else {
      toast.success('Welkom terug');
      navigate('/', { replace: true });
    }
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupWw.length < 6) {
      toast.error('Wachtwoord moet minimaal 6 tekens zijn');
      return;
    }
    setBezig(true);
    const { error } = await signUp(signupEmail, signupWw, naam);
    setBezig(false);
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Dit e-mailadres is al geregistreerd');
      } else {
        toast.error('Account aanmaken mislukt. Probeer het opnieuw of neem contact op met een beheerder.');
      }
    } else {
      toast.success('Account aangemaakt. Wacht op activatie door een beheerder.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/logo-bito-vastgoed.png"
            alt="Bito Vastgoed"
            className="mx-auto h-20 w-auto max-w-[160px] object-contain"
          />
          <p className="text-sm text-muted-foreground mt-2">Interne dealflow & CRM</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm space-y-4">
          <GoogleButton />
          <AppleButton />
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">of</span>
            </div>
          </div>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Inloggen</TabsTrigger>
              <TabsTrigger value="signup">Account aanvragen</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={onLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">E-mailadres</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="naam@bitovastgoed.nl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-ww">Wachtwoord</Label>
                  <Input
                    id="login-ww"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={loginWw}
                    onChange={e => setLoginWw(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={bezig}>
                  {bezig && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Inloggen
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={onSignup} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-naam">Volledige naam</Label>
                  <Input
                    id="signup-naam"
                    type="text"
                    required
                    value={naam}
                    onChange={e => setNaam(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">E-mailadres</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-ww">Wachtwoord</Label>
                  <Input
                    id="signup-ww"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={signupWw}
                    onChange={e => setSignupWw(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Minimaal 6 tekens.</p>
                </div>
                <Button type="submit" className="w-full" disabled={bezig}>
                  {bezig && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Account aanvragen
                </Button>
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Nieuwe accounts worden handmatig geactiveerd door een beheerder.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
