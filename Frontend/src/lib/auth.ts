// lib/auth.ts
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';

export interface AuthState {
  isSignedIn: boolean;
  isLoaded: boolean;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    email: string | null;
    profileImageUrl: string | null;
  } | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

export function useAuthState(): AuthState {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  // Wait for both auth and user to be loaded
  const isLoaded = authLoaded && userLoaded;

  return {
    isSignedIn: isLoaded ? isSignedIn || false : false,
    isLoaded,
    user:
      isLoaded && user
        ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            email: user.primaryEmailAddress?.emailAddress || null,
            profileImageUrl: user.imageUrl || null,
          }
        : null,
    getToken,
    signOut,
  };
}

export function useToken(): () => Promise<string | null> {
  const { getToken } = useAuth();
  return getToken;
}
