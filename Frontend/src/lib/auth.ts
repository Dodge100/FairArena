export { useAuth, useAuthState, useToken } from '../contexts/AuthContext';


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
