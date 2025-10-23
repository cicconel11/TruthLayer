/**
 * Example usage of the Bypass Service
 * 
 * This file demonstrates how to configure and use the bypass service
 * for handling CAPTCHAs and Cloudflare challenges during web scraping.
 */

import { BypassServiceImpl } from './bypass-service';
import { BypassConfig, CaptchaChallenge } from '../types/bypass';

// Example configuration for bypass service
const exampleConfig: BypassConfig = {
    captcha: {
        enabled: true,
        provider: 'twocaptcha', // or 'anticaptcha', 'capsolver'
        apiKey: process.env.BYPASS_CAPTCHA_API_KEY || '',
        timeout: 120000, // 2 minutes
        pollingInterval: 3000, // 3 seconds
    },
    cloudflare: {
        enabled: true,
        timeout: 30000, // 30 seconds
    },
    retries: {
        maxAttempts: 3,
        baseDelay: 1000, // 1 second
        maxDelay: 30000, // 30 seconds
        backoffMultiplier: 2,
    },
};

/**
 * Example: Using bypass service in a scraper
 */
export async function exampleScraperWithBypass() {
    const bypassService = new BypassServiceImpl(exampleConfig);

    // Check if bypass service is available
    const isAvailable = await bypassService.isAvailable();
    console.log('Bypass service available:', isAvailable);

    // Example CAPTCHA challenge
    const captchaChallenge: CaptchaChallenge = {
        type: 'recaptcha_v2',
        siteKey: '6LdRcpIUAAAAAH7Q4K7ZHQJBm9HjZpR8gOQiOvT7',
        pageUrl: 'https://example.com/search',
    };

    try {
        // Solve CAPTCHA if needed
        if (exampleConfig.captcha.enabled) {
            const solution = await bypassService.solveCaptcha(captchaChallenge);
            console.log('CAPTCHA solved:', solution.token.substring(0, 20) + '...');
        }

        // Use retry mechanism for robust scraping
        const result = await bypassService.withRetry(async () => {
            // Your scraping logic here
            console.log('Performing scraping operation...');
            return 'Scraping successful';
        }, 'example scraping operation');

        console.log('Result:', result);
    } catch (error) {
        console.error('Bypass failed:', error);
    }
}

/**
 * Environment variables needed for bypass service:
 * 
 * BYPASS_CAPTCHA_ENABLED=true
 * BYPASS_CAPTCHA_PROVIDER=twocaptcha
 * BYPASS_CAPTCHA_API_KEY=your_api_key_here
 * BYPASS_CAPTCHA_TIMEOUT=120000
 * BYPASS_CAPTCHA_POLLING_INTERVAL=3000
 * 
 * BYPASS_CLOUDFLARE_ENABLED=true
 * BYPASS_CLOUDFLARE_TIMEOUT=30000
 * 
 * BYPASS_RETRY_MAX_ATTEMPTS=3
 * BYPASS_RETRY_BASE_DELAY=1000
 * BYPASS_RETRY_MAX_DELAY=30000
 * BYPASS_RETRY_BACKOFF_MULTIPLIER=2
 */

/**
 * Cost considerations:
 * 
 * - 2captcha: ~$0.002 per CAPTCHA
 * - AntiCaptcha: ~$0.002 per CAPTCHA  
 * - CapSolver: ~$0.002 per CAPTCHA
 * 
 * Recommended daily budget: $5-10 for moderate scraping
 * Monitor usage through provider dashboards
 */

/**
 * Fallback strategies when bypass fails:
 * 
 * 1. Proxy rotation (implemented in BaseScraper)
 * 2. User-agent rotation (implemented in BaseScraper)
 * 3. Request throttling (implemented in BaseScraper)
 * 4. Manual intervention alerts
 * 5. Graceful degradation (skip problematic sources)
 */