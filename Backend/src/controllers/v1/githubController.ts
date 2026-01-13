import { Request, Response } from 'express';
import { ENV } from '../../config/env.js';
import { redis } from '../../config/redis.js';
import logger from '../../utils/logger.js';

const GITHUB_CACHE_KEY = 'github:repo_info';
const CACHE_TTL = 6 * 60 * 60; // 6 hours in seconds

interface GitHubRepoResponse {
    pushed_at: string;
    updated_at: string;
    html_url: string;
}

interface CachedRepoInfo {
    lastUpdated: string;
    repoUrl: string;
}

/**
 * Fetch last updated date from GitHub repository
 * GET /api/v1/github/last-updated
 */
export const getLastUpdated = async (req: Request, res: Response) => {
    try {
        // Try to get from Redis cache first
        const cachedStr = await redis.get<string>(GITHUB_CACHE_KEY);

        if (cachedStr) {
            try {
                const cached = JSON.parse(cachedStr) as CachedRepoInfo;
                if (cached.lastUpdated && cached.repoUrl) {
                    logger.info('Returning GitHub repo info from cache');
                    return res.status(200).json({
                        success: true,
                        data: {
                            ...cached,
                            cached: true,
                        },
                    });
                }
            } catch (e) {
                // Ignore parse error, fetch fresh
            }
        }

        // Fetch from GitHub API
        let githubPat = ENV.GITHUB_PAT || process.env.GITHUB_PAT;

        if (!githubPat) {
            logger.warn('GitHub PAT not configured');
            return res.status(503).json({
                success: false,
                message: 'GitHub integration not configured',
            });
        }

        githubPat = githubPat.trim();
        const repoName = ENV.GITHUB_REPO || 'FairArena/FairArena';

        const response = await fetch(`https://api.github.com/repos/${repoName}`, {
            headers: {
                'Authorization': `Bearer ${githubPat}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'FairArena-App',
            },
        });

        if (!response.ok) {
            const is404 = response.status === 404;
            const logMethod = is404 ? logger.warn : logger.error;

            // If 404, try to check if PAT is valid by fetching user
            let patUser = 'unknown';
            if (is404) {
                try {
                    const userRes = await fetch('https://api.github.com/user', {
                        headers: { 'Authorization': `Bearer ${githubPat}`, 'User-Agent': 'FairArena-App' }
                    });
                    if (userRes.ok) {
                        const userData = await userRes.json();
                        patUser = userData.login;
                    } else {
                        patUser = `invalid_token_${userRes.status}`;
                    }
                } catch (e) { patUser = 'check_failed'; }
            }

            logMethod.call(logger, 'GitHub API request failed', {
                status: response.status,
                statusText: response.statusText,
                repo: repoName,
                hasPat: !!githubPat,
                patPrefix: githubPat.substring(0, 4) + '...',
                patBelongsTo: patUser,
            });

            return res.status(response.status).json({
                success: false,
                message: is404 ? 'Repository not found or access denied' : 'Failed to fetch from GitHub',
            });
        }

        const data = await response.json() as GitHubRepoResponse;

        const repoInfo: CachedRepoInfo = {
            lastUpdated: data.pushed_at || data.updated_at,
            repoUrl: data.html_url
        };

        // Cache the result in Redis
        await redis.setex(GITHUB_CACHE_KEY, CACHE_TTL, JSON.stringify(repoInfo));

        logger.info('Fetched and cached GitHub repo info', { ...repoInfo });

        return res.status(200).json({
            success: true,
            data: {
                ...repoInfo,
                cached: false,
            },
        });
    } catch (error) {
        logger.error('Error fetching GitHub repo info', {
            error: error instanceof Error ? error.message : String(error),
        });

        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};
