import { ENV } from './env.js';

/**
 * OAuth User Data - standardized format from all providers
 */
export interface OAuthUserData {
    providerId: string; // Unique ID from provider
    email: string;
    emailVerified?: boolean;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
    providerName: string; // 'google', 'github', etc.
}

/**
 * OAuth Provider Configuration
 */
export interface OAuthProviderConfig {
    name: string; // 'google', 'github', 'microsoft', etc.
    displayName: string; // 'Google', 'GitHub', 'Microsoft', etc.

    // OAuth URLs
    authUrl: string;
    tokenUrl: string;
    userInfoUrl?: string; // Some providers need this

    // Credentials
    clientId: string;
    clientSecret: string;
    callbackUrl: string;

    // OAuth parameters
    scopes: string[];
    responseType?: string;
    grantType?: string;

    // Custom user data extraction
    extractUserData: (userData: any, accessToken?: string) => Promise<OAuthUserData> | OAuthUserData;

    // Custom token exchange (for providers with non-standard flows)
    exchangeToken?: (code: string) => Promise<{ accessToken: string; idToken?: string }>;
}

/**
 * OAuth Provider Registry
 */
export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
    google: {
        name: 'google',
        displayName: 'Google',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId: ENV.GOOGLE_CLIENT_ID,
        clientSecret: ENV.GOOGLE_CLIENT_SECRET,
        callbackUrl: ENV.GOOGLE_CALLBACK_URL,
        scopes: ['openid', 'email', 'profile'],
        responseType: 'code',
        grantType: 'authorization_code',
        extractUserData: (payload: any): OAuthUserData => ({
            providerId: payload.sub,
            email: payload.email,
            emailVerified: payload.email_verified || true,
            firstName: payload.given_name || null,
            lastName: payload.family_name || null,
            profileImageUrl: payload.picture || null,
            providerName: 'google',
        }),
    },

    github: {
        name: 'github',
        displayName: 'GitHub',
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        clientId: ENV.GITHUB_CLIENT_ID,
        clientSecret: ENV.GITHUB_CLIENT_SECRET,
        callbackUrl: ENV.GITHUB_CALLBACK_URL,
        scopes: ['read:user', 'user:email'],
        responseType: 'code',
        grantType: 'authorization_code',
        extractUserData: async (githubUser: any, accessToken?: string): Promise<OAuthUserData> => {
            let email = githubUser.email;

            // If email is private, fetch it separately
            if (!email && accessToken) {
                const emailResponse = await fetch('https://api.github.com/user/emails', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (emailResponse.ok) {
                    const emails = await emailResponse.json();
                    const primaryEmail = emails.find((e: any) => e.primary && e.verified);
                    if (primaryEmail) email = primaryEmail.email;
                }
            }

            if (!email) throw new Error('EMAIL_MISSING');

            return {
                providerId: String(githubUser.id),
                email,
                emailVerified: true,
                firstName: githubUser.name?.split(' ')[0] || githubUser.login || null,
                lastName: githubUser.name?.split(' ').slice(1).join(' ') || null,
                profileImageUrl: githubUser.avatar_url || null,
                providerName: 'github',
            };
        },
    },

    microsoft: {
        name: 'microsoft',
        displayName: 'Microsoft',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        clientId: ENV.MICROSOFT_CLIENT_ID,
        clientSecret: ENV.MICROSOFT_CLIENT_SECRET,
        callbackUrl: ENV.MICROSOFT_CALLBACK_URL,
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        responseType: 'code',
        grantType: 'authorization_code',
        extractUserData: (msUser: any): OAuthUserData => ({
            providerId: msUser.id,
            email: msUser.mail || msUser.userPrincipalName,
            emailVerified: true,
            firstName: msUser.givenName || null,
            lastName: msUser.surname || null,
            profileImageUrl: null, // Microsoft Graph requires separate call for photo
            providerName: 'microsoft',
        }),
    },

    discord: {
        name: 'discord',
        displayName: 'Discord',
        authUrl: 'https://discord.com/api/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        userInfoUrl: 'https://discord.com/api/users/@me',
        clientId: ENV.DISCORD_CLIENT_ID,
        clientSecret: ENV.DISCORD_CLIENT_SECRET,
        callbackUrl: ENV.DISCORD_CALLBACK_URL,
        scopes: ['identify', 'email'],
        responseType: 'code',
        grantType: 'authorization_code',
        extractUserData: (discordUser: any): OAuthUserData => ({
            providerId: discordUser.id,
            email: discordUser.email,
            emailVerified: discordUser.verified || false,
            firstName: discordUser.username || null,
            lastName: null,
            profileImageUrl: discordUser.avatar
                ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                : null,
            providerName: 'discord',
        }),
    },

    linkedin: {
        name: 'linkedin',
        displayName: 'LinkedIn',
        authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
        clientId: ENV.LINKEDIN_CLIENT_ID,
        clientSecret: ENV.LINKEDIN_CLIENT_SECRET,
        callbackUrl: ENV.LINKEDIN_CALLBACK_URL,
        scopes: ['openid', 'profile', 'email'],
        responseType: 'code',
        grantType: 'authorization_code',
        extractUserData: (linkedinUser: any): OAuthUserData => ({
            providerId: linkedinUser.sub,
            email: linkedinUser.email,
            emailVerified: linkedinUser.email_verified || false,
            firstName: linkedinUser.given_name || null,
            lastName: linkedinUser.family_name || null,
            profileImageUrl: linkedinUser.picture || null,
            providerName: 'linkedin',
        }),
    },

    slack: {
        name: 'slack',
        displayName: 'Slack',
        authUrl: 'https://slack.com/openid/connect/authorize',
        tokenUrl: 'https://slack.com/api/openid.connect.token',
        userInfoUrl: 'https://slack.com/api/openid.connect.userInfo',
        clientId: ENV.SLACK_CLIENT_ID,
        clientSecret: ENV.SLACK_CLIENT_SECRET,
        callbackUrl: ENV.SLACK_CALLBACK_URL,
        scopes: ['openid', 'email', 'profile'],
        responseType: 'code',
        grantType: 'authorization_code',
        extractUserData: (slackUser: any): OAuthUserData => ({
            providerId: slackUser.sub,
            email: slackUser.email,
            emailVerified: slackUser.email_verified || false,
            firstName: slackUser.given_name || slackUser.name?.split(' ')[0] || null,
            lastName: slackUser.family_name || slackUser.name?.split(' ').slice(1).join(' ') || null,
            profileImageUrl: slackUser.picture || null,
            providerName: 'slack',
        }),
    },

    notion: {
        name: 'notion',
        displayName: 'Notion',
        authUrl: 'https://api.notion.com/v1/oauth/authorize',
        tokenUrl: 'https://api.notion.com/v1/oauth/token',
        clientId: ENV.NOTION_CLIENT_ID,
        clientSecret: ENV.NOTION_CLIENT_SECRET,
        callbackUrl: ENV.NOTION_CALLBACK_URL,
        scopes: [],
        responseType: 'code',
        grantType: 'authorization_code',
        extractUserData: (notionData: any): OAuthUserData => ({
            providerId: notionData.owner?.user?.id || notionData.bot_id,
            email: notionData.owner?.user?.person?.email || '',
            emailVerified: true,
            firstName: notionData.owner?.user?.name?.split(' ')[0] || null,
            lastName: notionData.owner?.user?.name?.split(' ').slice(1).join(' ') || null,
            profileImageUrl: notionData.owner?.user?.avatar_url || null,
            providerName: 'notion',
        }),
    },

    x: {
        name: 'x',
        displayName: 'X (Twitter)',
        authUrl: 'https://twitter.com/i/oauth2/authorize',
        tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        userInfoUrl: 'https://api.twitter.com/2/users/me',
        clientId: ENV.X_CLIENT_ID,
        clientSecret: ENV.X_CLIENT_SECRET,
        callbackUrl: ENV.X_CALLBACK_URL,
        scopes: ['tweet.read', 'users.read', 'offline.access'],
        responseType: 'code',
        grantType: 'authorization_code',
        extractUserData: (xUser: any): OAuthUserData => ({
            providerId: xUser.data?.id,
            email: '', // X doesn't provide email in basic scope
            emailVerified: false,
            firstName: xUser.data?.name?.split(' ')[0] || xUser.data?.username || null,
            lastName: xUser.data?.name?.split(' ').slice(1).join(' ') || null,
            profileImageUrl: xUser.data?.profile_image_url || null,
            providerName: 'x',
        }),
    },

    zoho: {
        name: 'zoho',
        displayName: 'Zoho',
        authUrl: 'https://accounts.zoho.com/oauth/v2/auth',
        tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
        userInfoUrl: 'https://accounts.zoho.com/oauth/user/info',
        clientId: ENV.ZOHO_CLIENT_ID,
        clientSecret: ENV.ZOHO_CLIENT_SECRET,
        callbackUrl: ENV.ZOHO_CALLBACK_URL,
        scopes: ['AaaServer.profile.READ', 'email'],
        responseType: 'code',
        grantType: 'authorization_code',
        extractUserData: (zohoUser: any): OAuthUserData => ({
            providerId: zohoUser.ZUID,
            email: zohoUser.Email,
            emailVerified: true,
            firstName: zohoUser.First_Name || zohoUser.Display_Name?.split(' ')[0] || null,
            lastName: zohoUser.Last_Name || zohoUser.Display_Name?.split(' ').slice(1).join(' ') || null,
            profileImageUrl: null,
            providerName: 'zoho',
        }),
    },

    linear: {
        name: 'linear',
        displayName: 'Linear',
        authUrl: 'https://linear.app/oauth/authorize',
        tokenUrl: 'https://api.linear.app/oauth/token',
        userInfoUrl: 'https://api.linear.app/graphql',
        clientId: ENV.LINEAR_CLIENT_ID,
        clientSecret: ENV.LINEAR_CLIENT_SECRET,
        callbackUrl: ENV.LINEAR_CALLBACK_URL,
        scopes: ['read'],
        responseType: 'code',
        grantType: 'authorization_code',
        extractUserData: (linearUser: any): OAuthUserData => ({
            providerId: linearUser.data?.viewer?.id,
            email: linearUser.data?.viewer?.email,
            emailVerified: true,
            firstName: linearUser.data?.viewer?.name?.split(' ')[0] || null,
            lastName: linearUser.data?.viewer?.name?.split(' ').slice(1).join(' ') || null,
            profileImageUrl: linearUser.data?.viewer?.avatarUrl || null,
            providerName: 'linear',
        }),
    },

    dropbox: {
        name: 'dropbox',
        displayName: 'Dropbox',
        authUrl: 'https://www.dropbox.com/oauth2/authorize',
        tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
        userInfoUrl: 'https://api.dropboxapi.com/2/users/get_current_account',
        clientId: ENV.DROPBOX_CLIENT_ID,
        clientSecret: ENV.DROPBOX_CLIENT_SECRET,
        callbackUrl: ENV.DROPBOX_CALLBACK_URL,
        scopes: ['account_info.read'],
        responseType: 'code',
        grantType: 'authorization_code',
        extractUserData: (dropboxUser: any): OAuthUserData => ({
            providerId: dropboxUser.account_id,
            email: dropboxUser.email,
            emailVerified: dropboxUser.email_verified || false,
            firstName: dropboxUser.name?.given_name || null,
            lastName: dropboxUser.name?.surname || null,
            profileImageUrl: dropboxUser.profile_photo_url || null,
            providerName: 'dropbox',
        }),
    },

    gitlab: {
        name: 'gitlab',
        displayName: 'GitLab',
        authUrl: 'https://gitlab.com/oauth/authorize',
        tokenUrl: 'https://gitlab.com/oauth/token',
        userInfoUrl: 'https://gitlab.com/api/v4/user',
        clientId: ENV.GITLAB_CLIENT_ID,
        clientSecret: ENV.GITLAB_CLIENT_SECRET,
        callbackUrl: ENV.GITLAB_CALLBACK_URL,
        scopes: ['read_user', 'email'],
        responseType: 'code',
        grantType: 'authorization_code',
        extractUserData: (gitlabUser: any): OAuthUserData => ({
            providerId: String(gitlabUser.id),
            email: gitlabUser.email,
            emailVerified: gitlabUser.confirmed_at ? true : false,
            firstName: gitlabUser.name?.split(' ')[0] || gitlabUser.username || null,
            lastName: gitlabUser.name?.split(' ').slice(1).join(' ') || null,
            profileImageUrl: gitlabUser.avatar_url || null,
            providerName: 'gitlab',
        }),
    },

    huggingface: {
        name: 'huggingface',
        displayName: 'Hugging Face',
        authUrl: 'https://huggingface.co/oauth/authorize',
        tokenUrl: 'https://huggingface.co/oauth/token',
        userInfoUrl: 'https://huggingface.co/api/whoami-v2',
        clientId: ENV.HUGGINGFACE_CLIENT_ID,
        clientSecret: ENV.HUGGINGFACE_CLIENT_SECRET,
        callbackUrl: ENV.HUGGINGFACE_CALLBACK_URL,
        scopes: ['openid', 'profile', 'email'],
        responseType: 'code',
        grantType: 'authorization_code',
        extractUserData: (hfUser: any): OAuthUserData => ({
            providerId: hfUser.id || hfUser.sub,
            email: hfUser.email,
            emailVerified: hfUser.emailVerified || false,
            firstName: hfUser.name?.split(' ')[0] || hfUser.fullname?.split(' ')[0] || null,
            lastName: hfUser.name?.split(' ').slice(1).join(' ') || hfUser.fullname?.split(' ').slice(1).join(' ') || null,
            profileImageUrl: hfUser.avatarUrl || hfUser.picture || null,
            providerName: 'huggingface',
        }),
    },
};

/**
 * Get provider configuration by name
 */
export function getOAuthProvider(providerName: string): OAuthProviderConfig {
    const provider = OAUTH_PROVIDERS[providerName.toLowerCase()];
    if (!provider) {
        throw new Error(`Unknown OAuth provider: ${providerName}`);
    }
    return provider;
}

/**
 * Get all configured provider names
 */
export function getConfiguredProviders(): string[] {
    return Object.keys(OAUTH_PROVIDERS);
}
