import logger from './logger.js';

export interface LocationData {
    city: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
}

// In-memory cache for IP lookups (TTL: 1 hour)
const locationCache = new Map<string, { data: LocationData | null; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get location information from an IP address
 * Uses ip-api.com
 */
export async function getLocationFromIP(ip: string): Promise<LocationData | null> {
    // Basic sanitization
    if (!ip) return null;

    // Handle localhost/development IPs
    if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost' || ip === 'unknown') {
        return null;
    }

    // Handle private network IPs and IPv6 mapped IPv4
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.') || ip.includes('::ffff:')) {
        return null;
    }

    // Check cache
    const cached = locationCache.get(ip);
    if (cached && cached.expires > Date.now()) {
        return cached.data;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const response = await fetch(
            `http://ip-api.com/json/${ip}?fields=status,message,city,regionName,country,lat,lon`,
            { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (!response.ok) return null;

        const data = await response.json();

        if (data.status === 'success') {
            const locationData: LocationData = {
                city: data.city,
                region: data.regionName,
                country: data.country,
                latitude: data.lat,
                longitude: data.lon
            };

            locationCache.set(ip, { data: locationData, expires: Date.now() + CACHE_TTL });
            return locationData;
        }
    } catch (error) {
        logger.debug('IP geolocation lookup failed', { ip, error: error instanceof Error ? error.message : String(error) });
    }

    return null;
}

/**
 * Format location for display string
 */
export function formatLocationString(location: LocationData | null, ip: string): string {
    if (location && location.city && location.country) {
        return `${location.city}, ${location.country}`;
    }

    if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return 'Local Network';
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.includes('::ffff:')) return 'Private Network';

    return 'Unknown Location';
}
