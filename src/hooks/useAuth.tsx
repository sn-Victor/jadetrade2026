import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { awsConfig } from '@/config/aws';
import { apiClient } from '@/lib/api';
import { logger } from '@/lib/logger';

const userPool = new CognitoUserPool({
  UserPoolId: awsConfig.cognito.userPoolId,
  ClientId: awsConfig.cognito.clientId,
});

interface User {
  id: string;
  email: string;
  name?: string;
  tier: 'free' | 'pro' | 'enterprise';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<{ error: Error | null }>;
  refreshTier: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserTier = async (): Promise<'free' | 'pro' | 'enterprise'> => {
    try {
      const tier = await apiClient.getUserTier();
      return tier as 'free' | 'pro' | 'enterprise';
    } catch {
      return 'free';
    }
  };

  const updateTokenAndUser = async (session: CognitoUserSession) => {
    const idToken = session.getIdToken();
    const token = idToken.getJwtToken();
    apiClient.setToken(token);

    const payload = idToken.decodePayload();
    logger.setUserId(payload.sub);

    const tier = await fetchUserTier();

    setUser({
      id: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      tier,
    });

    logger.info('User authenticated', { email: payload.email, tier });
  };

  const refreshTier = async () => {
    if (user) {
      const tier = await fetchUserTier();
      setUser({ ...user, tier });
      logger.info('User tier refreshed', { tier });
    }
  };

  useEffect(() => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.getSession(async (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          setUser(null);
          apiClient.setToken(null);
          logger.info('No valid session found');
        } else {
          await updateTokenAndUser(session);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    logger.trackAuth('signup', true);
    return new Promise<{ error: Error | null }>((resolve) => {
      const attributeList = [
        new CognitoUserAttribute({ Name: 'email', Value: email }),
        new CognitoUserAttribute({ Name: 'name', Value: fullName }),
      ];

      userPool.signUp(email, password, attributeList, [], (err, result) => {
        if (err) {
          logger.trackAuth('signup', false, err.message);
          resolve({ error: err as Error });
        } else {
          logger.trackAuth('signup', true);
          resolve({ error: null });
        }
      });
    });
  };

  const confirmSignUp = async (email: string, code: string) => {
    return new Promise<{ error: Error | null }>((resolve) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) {
          logger.trackAuth('confirm', false, err.message);
          resolve({ error: err as Error });
        } else {
          logger.trackAuth('confirm', true);
          resolve({ error: null });
        }
      });
    });
  };

  const signIn = async (email: string, password: string) => {
    return new Promise<{ error: Error | null }>((resolve) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
      const authDetails = new AuthenticationDetails({ Username: email, Password: password });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: async (session) => {
          await updateTokenAndUser(session);
          logger.trackAuth('signin', true);
          resolve({ error: null });
        },
        onFailure: (err) => {
          logger.trackAuth('signin', false, err.message);
          resolve({ error: err as Error });
        },
      });
    });
  };

  const signOut = async () => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    setUser(null);
    apiClient.setToken(null);
    logger.setUserId(null);
    logger.trackAuth('signout', true);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, confirmSignUp, refreshTier }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};