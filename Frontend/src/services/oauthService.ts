/**
 * OAuth Service
 *
 * Frontend API client for OAuth application management and consent.
 */

import { apiFetch, publicApiFetch } from '@/lib/apiClient';

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

// Helper to make authenticated requests
async function authFetch<T>(
    endpoint: string,
    options: RequestInit = {},
): Promise<T> {
    const response = await apiFetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error_description || error.message || `HTTP ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return undefined as T;
    }

    return response.json();
}

// ============================================
// APPLICATION MANAGEMENT
// ============================================

export async function listApplications(): Promise<{ applications: OAuthApplication[] }> {
    return authFetch('/oauth/applications');
}

export async function getApplication(id: string): Promise<{ application: OAuthApplication & { stats: object } }> {
    return authFetch(`/oauth/applications/${id}`);
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
    return authFetch('/oauth/applications', {
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
    return authFetch(`/oauth/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

export async function deleteApplication(id: string): Promise<void> {
    return authFetch(`/oauth/applications/${id}`, {
        method: 'DELETE',
    });
}

export async function regenerateSecret(id: string): Promise<{ clientSecret: string; message: string }> {
    return authFetch(`/oauth/applications/${id}/secret`, {
        method: 'POST',
    });
}

// ============================================
// CONSENT MANAGEMENT
// ============================================

export async function listConsents(): Promise<{ consents: OAuthConsent[] }> {
    return authFetch('/oauth/consents');
}

export async function getConsent(applicationId: string): Promise<{ consent: OAuthConsent }> {
    return authFetch(`/oauth/consents/${applicationId}`);
}

export async function revokeConsent(applicationId: string): Promise<void> {
    return authFetch(`/oauth/consents/${applicationId}`, {
        method: 'DELETE',
    });
}

// ============================================
// AUTHORIZATION REQUEST (for consent page)
// ============================================

export async function getAuthorizationRequest(requestId: string): Promise<AuthorizationRequest> {
    const response = await publicApiFetch(`${API_BASE_URL}/oauth/authorize/request/${requestId}`);

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error_description || error.message || 'Failed to load authorization request');
    }

    return response.json();
}

export async function submitConsent(data: {
    request_id: string;
    action: 'approve' | 'deny';
    scopes?: string[];
}): Promise<void> {
    const response = await apiFetch(`${API_BASE_URL}/oauth/authorize/consent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    // Consent endpoint redirects on success
    if (response.redirected) {
        window.location.href = response.url;
        return;
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error_description || error.message || 'Failed to submit consent');
    }
}
