import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gem, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { signIn, signUp, confirmSignUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (needsConfirmation) {
        const { error } = await confirmSignUp(email, confirmationCode);
        if (error) {
          toast({ title: 'Confirmation failed', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Email confirmed! Please sign in.' });
          setNeedsConfirmation(false);
          setIsLogin(true);
        }
      } else if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('not confirmed')) {
            setNeedsConfirmation(true);
            toast({ title: 'Please confirm your email', description: 'Check your inbox for the confirmation code' });
          } else {
            toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
          }
        } else {
          toast({ title: 'Welcome Back!' });
          navigate('/dashboard');
        }
      } else {
        if (!fullName.trim()) {
          toast({ title: 'Name required', description: 'Please enter your full name', variant: 'destructive' });
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, fullName);
        if (error) {
          toast({ title: 'Sign up failed', description: error.message, variant: 'destructive' });
        } else {
          setNeedsConfirmation(true);
          toast({ title: 'Check your email!', description: 'We sent you a confirmation code' });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 gradient-bg -z-10" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="glass rounded-2xl p-8">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="relative">
              <Gem className="w-10 h-10 text-primary fill-primary/20" />
            </div>
            <span className="font-semibold text-2xl tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">JadeTrade</span>
          </div>

          <h1 className="text-2xl font-semibold text-center mb-2">
            {needsConfirmation ? 'Confirm your email' : isLogin ? 'Welcome Back' : 'Create your account'}
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            {needsConfirmation ? 'Enter the code we sent to your email' : isLogin ? 'Sign in to access your trading dashboard' : 'Start your algorithmic trading journey'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {needsConfirmation ? (
              <div className="space-y-2">
                <Label htmlFor="code">Confirmation Code</Label>
                <Input id="code" type="text" placeholder="123456" value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value)} className="bg-secondary border-border" required />
              </div>
            ) : (
              <>
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10 bg-secondary border-border" />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-secondary border-border" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-secondary border-border" required minLength={6} />
                  </div>
                </div>
              </>
            )}

            <Button type="submit" className="w-full button-gradient" disabled={loading}>
              {loading ? 'Please wait...' : needsConfirmation ? 'Confirm Email' : isLogin ? 'Sign In' : 'Create Account'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </form>

          {!needsConfirmation && (
            <div className="mt-6 text-center">
              <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          )}
          {needsConfirmation && (
            <div className="mt-6 text-center">
              <button onClick={() => setNeedsConfirmation(false)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;