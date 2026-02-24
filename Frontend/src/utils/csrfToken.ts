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

let csrfToken: string | null = null;

/**
 * Get the current CSRF token
 */
export function getCsrfToken(): string | null {
  return csrfToken;
}

/**
 * Set the CSRF token (called when we receive it from the backend)
 */
export function setCsrfToken(token: string): void {
  csrfToken = token;
  // Optionally persist to sessionStorage for page refreshes
  sessionStorage.setItem('csrf-token', token);
}

/**
 * Initialize CSRF token from sessionStorage on app load
 */
export function initializeCsrfToken(): void {
  const storedToken = sessionStorage.getItem('csrf-token');
  if (storedToken) {
    csrfToken = storedToken;
  }
}

/**
 * Clear the CSRF token (on logout)
 */
export function clearCsrfToken(): void {
  csrfToken = null;
  sessionStorage.removeItem('csrf-token');
}
