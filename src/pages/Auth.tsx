import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gem, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

// Sanitize error messages to avoid exposing sensitive info like client IDs
const sanitizeAuthError = (message: string): string => {
  // Map known Cognito errors to user-friendly messages
  const errorMap: Record<string, string> = {
    'User does not exist': 'Invalid email or password',
    'Incorrect username or password': 'Invalid email or password',
    'User is not confirmed': 'Please verify your email first',
    'Invalid verification code': 'The verification code is incorrect',
    'Password did not conform with policy': 'Password must be at least 8 characters with uppercase, lowercase, number, and symbol',
    'An account with the given email already exists': 'An account with this email already exists',
  };

  // Check for known error patterns
  for (const [pattern, friendlyMessage] of Object.entries(errorMap)) {
    if (message.includes(pattern)) {
      return friendlyMessage;
    }
  }

  // If message contains sensitive patterns (client IDs, pool IDs), return generic message
  if (message.includes('Client') || message.includes('pool') || message.includes('_')) {
    return 'Authentication failed. Please try again.';
  }

  // Return original message if it seems safe
  return message;
};

type AuthMode = 'login' | 'signup' | 'confirm' | 'forgot' | 'resetPassword';

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { signIn, signUp, confirmSignUp, forgotPassword, confirmForgotPassword, user } = useAuth();
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
      switch (mode) {
        case 'confirm':
          const confirmResult = await confirmSignUp(email, confirmationCode);
          if (confirmResult.error) {
            toast({ title: 'Confirmation failed', description: sanitizeAuthError(confirmResult.error.message), variant: 'destructive' });
          } else {
            toast({ title: 'Email confirmed! Please sign in.' });
            setMode('login');
            setConfirmationCode('');
          }
          break;

        case 'login':
          const loginResult = await signIn(email, password);
          if (loginResult.error) {
            if (loginResult.error.message.includes('not confirmed')) {
              setMode('confirm');
              toast({ title: 'Please confirm your email', description: 'Check your inbox for the confirmation code' });
            } else {
              toast({ title: 'Login failed', description: sanitizeAuthError(loginResult.error.message), variant: 'destructive' });
            }
          } else {
            toast({ title: 'Welcome Back!' });
            navigate('/dashboard');
          }
          break;

        case 'signup':
          if (!fullName.trim()) {
            toast({ title: 'Name required', description: 'Please enter your full name', variant: 'destructive' });
            setLoading(false);
            return;
          }
          if (password !== confirmPassword) {
            toast({ title: 'Passwords do not match', description: 'Please make sure both passwords are the same', variant: 'destructive' });
            setLoading(false);
            return;
          }
          const signupResult = await signUp(email, password, fullName);
          if (signupResult.error) {
            toast({ title: 'Sign up failed', description: sanitizeAuthError(signupResult.error.message), variant: 'destructive' });
          } else {
            setMode('confirm');
            toast({ title: 'Check your email!', description: 'We sent you a confirmation code' });
          }
          break;

        case 'forgot':
          const forgotResult = await forgotPassword(email);
          if (forgotResult.error) {
            toast({ title: 'Failed to send reset code', description: sanitizeAuthError(forgotResult.error.message), variant: 'destructive' });
          } else {
            setMode('resetPassword');
            toast({ title: 'Check your email!', description: 'We sent you a password reset code' });
          }
          break;

        case 'resetPassword':
          if (password !== confirmPassword) {
            toast({ title: 'Passwords do not match', description: 'Please make sure both passwords are the same', variant: 'destructive' });
            setLoading(false);
            return;
          }
          const resetResult = await confirmForgotPassword(email, confirmationCode, password);
          if (resetResult.error) {
            toast({ title: 'Password reset failed', description: sanitizeAuthError(resetResult.error.message), variant: 'destructive' });
          } else {
            toast({ title: 'Password reset successful!', description: 'Please sign in with your new password' });
            setMode('login');
            setPassword('');
            setConfirmPassword('');
            setConfirmationCode('');
          }
          break;
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
            {mode === 'confirm' && 'Confirm your email'}
            {mode === 'login' && 'Welcome Back'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'resetPassword' && 'Set new password'}
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            {mode === 'confirm' && 'Enter the code we sent to your email'}
            {mode === 'login' && 'Sign in to access your trading dashboard'}
            {mode === 'signup' && 'Start your algorithmic trading journey'}
            {mode === 'forgot' && 'Enter your email to receive a reset code'}
            {mode === 'resetPassword' && 'Enter the code and your new password'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Confirmation code for email confirm or password reset */}
            {(mode === 'confirm' || mode === 'resetPassword') && (
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input id="code" type="text" placeholder="123456" value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value)} className="bg-secondary border-border" required />
              </div>
            )}

            {/* Full name for signup */}
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10 bg-secondary border-border" required />
                </div>
              </div>
            )}

            {/* Email for login, signup, forgot */}
            {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-secondary border-border" required />
                </div>
              </div>
            )}

            {/* Password for login, signup, resetPassword */}
            {(mode === 'login' || mode === 'signup' || mode === 'resetPassword') && (
              <div className="space-y-2">
                <Label htmlFor="password">{mode === 'resetPassword' ? 'New Password' : 'Password'}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-secondary border-border" required minLength={8} />
                </div>
              </div>
            )}

            {/* Confirm password for signup and resetPassword */}
            {(mode === 'signup' || mode === 'resetPassword') && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 bg-secondary border-border" required minLength={8} />
                </div>
                {password && confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
              </div>
            )}

            <Button type="submit" className="w-full button-gradient" disabled={loading}>
              {loading ? 'Please wait...' :
                mode === 'confirm' ? 'Confirm Email' :
                mode === 'login' ? 'Sign In' :
                mode === 'signup' ? 'Create Account' :
                mode === 'forgot' ? 'Send Reset Code' :
                'Reset Password'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </form>

          {/* Footer links */}
          <div className="mt-6 text-center space-y-2">
            {mode === 'login' && (
              <>
                <button onClick={() => setMode('forgot')} className="text-sm text-primary hover:text-primary/80 transition-colors block w-full">
                  Forgot your password?
                </button>
                <button onClick={() => setMode('signup')} className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full">
                  Don't have an account? Sign up
                </button>
              </>
            )}
            {mode === 'signup' && (
              <button onClick={() => setMode('login')} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Already have an account? Sign in
              </button>
            )}
            {(mode === 'confirm' || mode === 'forgot' || mode === 'resetPassword') && (
              <button onClick={() => setMode('login')} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;