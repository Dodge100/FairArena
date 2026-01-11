export const getRedirectPath = (location: { state?: { from?: { pathname: string } } }): string => {
    let path = '/dashboard';

    // First check location state (from ProtectedLayout redirect)
    if (location.state?.from?.pathname) {
        path = location.state.from.pathname;
    }
    // Then check cookie (from OAuth MFA redirect)
    else {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; mfa_redirect=`);
        if (parts.length === 2) {
            const cookieRedirect = parts.pop()?.split(';').shift();
            if (cookieRedirect) {
                document.cookie = `mfa_redirect=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`; // Clean up
                path = cookieRedirect;
            }
        }
    }

    // Ensure path is decoded
    try {
        return decodeURIComponent(path);
    } catch {
        return path;
    }
};
