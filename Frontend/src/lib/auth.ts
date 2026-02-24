/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

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
