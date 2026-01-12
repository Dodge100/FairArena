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
