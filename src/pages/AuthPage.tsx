import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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
      toast.error(error.message === 'Invalid login credentials' ? 'Ongeldige inloggegevens' : error.message);
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
        toast.error(error.message);
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

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
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
