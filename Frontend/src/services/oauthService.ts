/**
 * OAuth Service
 *
 * Frontend API client for OAuth application management and consent.
 */

import { apiFetch, apiRequest } from '@/lib/apiClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Types
export interface OAuthApplication {
    id: string;
    clientId: string;
    name: string;
    description?: string;
    logoUrl?: string;
    websiteUrl?: string;
    privacyPolicyUrl?: string;
    termsOfServiceUrl?: string;
    redirectUris: string[];
    allowedScopes: string[];
    grantTypes: string[];
    isPublic: boolean;
    isActive: boolean;
    isVerified: boolean;
    isTrusted: boolean;
    createdAt: string;
    updatedAt: string;
    activeUsers?: number;
    activeTokens?: number;
}

export interface OAuthScope {
    name: string;
    displayName: string;
    description: string;
    isDangerous: boolean;
}

export interface OAuthConsent {
    id: string;
    application: {
        id: string;
        clientId: string;
        name: string;
        description?: string;
        logoUrl?: string;
        websiteUrl?: string;
        isVerified: boolean;
    };
    grantedScopes: string[];
    createdAt: string;
    updatedAt: string;
}

export interface AuthorizationRequest {
    application: {
        name: string;
        description?: string;
        logoUrl?: string;
        websiteUrl?: string;
        privacyPolicyUrl?: string;
        termsOfServiceUrl?: string;
        isVerified: boolean;
    };
    scopes: OAuthScope[];
    redirectUri: string;
    expiresAt: string;
}

// ============================================
// APPLICATION MANAGEMENT
// ============================================

export async function listApplications(): Promise<{ applications: OAuthApplication[] }> {
    return apiRequest(`${API_BASE_URL || ''}/api/v1/oauth/applications`);
}

export async function getApplication(id: string): Promise<{ application: OAuthApplication & { stats: object } }> {
    return apiRequest(`${API_BASE_URL || ''}/api/v1/oauth/applications/${id}`);
}

export async function createApplication(data: {
    name: string;
    description?: string;
    websiteUrl?: string;
    privacyPolicyUrl?: string;
    termsOfServiceUrl?: string;
    logoUrl?: string;
    redirectUris: string[];
    isPublic?: boolean;
    grantTypes?: string[];
}): Promise<{ application: OAuthApplication; clientSecret: string | null; message: string }> {
    return apiRequest(`${API_BASE_URL || ''}/api/v1/oauth/applications`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function updateApplication(
    id: string,
    data: {
        name?: string;
        description?: string;
        websiteUrl?: string;
        privacyPolicyUrl?: string;
        termsOfServiceUrl?: string;
        logoUrl?: string;
        redirectUris?: string[];
        isActive?: boolean;
    },
): Promise<{ application: OAuthApplication }> {
    return apiRequest(`${API_BASE_URL || ''}/api/v1/oauth/applications/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function deleteApplication(id: string): Promise<void> {
    return apiRequest(`${API_BASE_URL || ''}/api/v1/oauth/applications/${id}`, {
        method: 'DELETE',
    });
}

export async function regenerateSecret(id: string): Promise<{ clientSecret: string; message: string }> {
    return apiRequest(`${API_BASE_URL || ''}/api/v1/oauth/applications/${id}/secret`, {
        method: 'POST',
    });
}

// ============================================
// CONSENT MANAGEMENT
// ============================================

export async function listConsents(): Promise<{ consents: OAuthConsent[] }> {
    return apiRequest(`${API_BASE_URL || ''}/api/v1/oauth/consents`);
}

export async function getConsent(applicationId: string): Promise<{ consent: OAuthConsent }> {
    return apiRequest(`${API_BASE_URL || ''}/api/v1/oauth/consents/${applicationId}`);
}

export async function revokeConsent(applicationId: string): Promise<void> {
    return apiRequest(`${API_BASE_URL || ''}/api/v1/oauth/consents/${applicationId}`, {
        method: 'DELETE',
    });
}

// ============================================
// AUTHORIZATION REQUEST (for consent page)
// ============================================

export async function getAuthorizationRequest(requestId: string): Promise<AuthorizationRequest> {
    try {
        // Use the correct API v1 path
        const response = await apiFetch(`${API_BASE_URL}/api/v1/oauth/authorize/request/${requestId}`);

        if (!response.ok) {
            // Check if response is HTML (error page) or JSON
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('text/html')) {
                throw new Error('Authorization request not found or expired');
            }

            const error = await response.json().catch(() => ({ error_description: 'Failed to load authorization request' }));
            throw new Error(error.error_description || error.message || 'Failed to load authorization request');
        }

        // Backend returns data directly: { application, scopes, expiresAt, redirectUri }
        const data = await response.json();

        if (!data.application || !data.scopes) {
            throw new Error('Invalid authorization request response');
        }

        return data as AuthorizationRequest;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to load authorization request');
    }
}

export async function submitConsent(data: {
    request_id: string;
    action: 'approve' | 'deny';
    scopes?: string[];
    redirect_uri?: string;
}): Promise<void> {
    const response = await apiFetch(`${API_BASE_URL}/api/v1/oauth/authorize/consent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    // Handle JSON redirect (backend now returns { success: true, redirectUrl: '...' })
    const jsonData = await response.json().catch(() => ({}));

    if (response.ok && jsonData.redirectUrl) {
        window.location.href = jsonData.redirectUrl;
        return;
    }

    // Fallback for unexpected redirect (though backend should return JSON now)
    if (response.redirected) {
        window.location.href = response.url;
        return;
    }

    if (!response.ok) {
        throw new Error(jsonData.error_description || jsonData.message || 'Failed to submit consent');
    }
}
