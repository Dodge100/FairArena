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
    return apiRequest('/oauth/applications');
}

export async function getApplication(id: string): Promise<{ application: OAuthApplication & { stats: object } }> {
    return apiRequest(`/oauth/applications/${id}`);
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
    return apiRequest('/oauth/applications', {
        method: 'POST',
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
    return apiRequest(`/oauth/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

export async function deleteApplication(id: string): Promise<void> {
    return apiRequest(`/oauth/applications/${id}`, {
        method: 'DELETE',
    });
}

export async function regenerateSecret(id: string): Promise<{ clientSecret: string; message: string }> {
    return apiRequest(`/oauth/applications/${id}/secret`, {
        method: 'POST',
    });
}

// ============================================
// CONSENT MANAGEMENT
// ============================================

export async function listConsents(): Promise<{ consents: OAuthConsent[] }> {
    return apiRequest('/oauth/consents');
}

export async function getConsent(applicationId: string): Promise<{ consent: OAuthConsent }> {
    return apiRequest(`/oauth/consents/${applicationId}`);
}

export async function revokeConsent(applicationId: string): Promise<void> {
    return apiRequest(`/oauth/consents/${applicationId}`, {
        method: 'DELETE',
    });
}

// ============================================
// AUTHORIZATION REQUEST (for consent page)
// ============================================

export async function getAuthorizationRequest(requestId: string): Promise<AuthorizationRequest> {
    // This uses publicApiFetch originally, but apiRequest handles auth header automatically.
    // Use apiRequest for consistency and error handling.
    // If it needs to be strictly public (no auth header), we should use apiFetch, but mostly adding auth header is harmless.
    // However, if the endpoint rejects requests with auth headers (rare), keep that in mind.
    // Given the previous code used publicApiFetch, it implies no auth needed.
    // apiRequest adds auth if available.
    return apiRequest(`/oauth/authorize/request/${requestId}`);
}

export async function submitConsent(data: {
    request_id: string;
    action: 'approve' | 'deny';
    scopes?: string[];
    redirect_uri?: string;
}): Promise<void> {
    const response = await apiFetch(`${API_BASE_URL}/oauth/authorize/consent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    // Consent endpoint redirects on success (e.g., to the app)
    if (response.redirected) {
        window.location.href = response.url;
        return;
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error_description || error.message || 'Failed to submit consent');
    }
}
