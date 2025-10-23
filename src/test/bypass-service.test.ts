import { describe, it, expect, beforeEach } from 'vitest';
import { BypassServiceImpl } from '../services/bypass-service';
import { BypassConfig, BypassError, BypassException } from '../types/bypass';

describe('BypassService', () => {
    let bypassService: BypassServiceImpl;
    let mockConfig: BypassConfig;

    beforeEach(() => {
        mockConfig = {
            captcha: {
                enabled: false,
                provider: 'twocaptcha',
                apiKey: 'test-key',
                timeout: 120000,
                pollingInterval: 3000,
            },
            cloudflare: {
                enabled: false,
                timeout: 30000,
            },
            retries: {
                maxAttempts: 3,
                baseDelay: 1000,
                maxDelay: 30000,
                backoffMultiplier: 2,
            },
        };

        bypassService = new BypassServiceImpl(mockConfig);
    });

    describe('isAvailable', () => {
        it('should return true when captcha is disabled', async () => {
            const available = await bypassService.isAvailable();
            expect(available).toBe(true);
        });
    });

    describe('solveCaptcha', () => {
        it('should throw error when captcha is disabled', async () => {
            const challenge = {
                type: 'recaptcha_v2' as const,
                siteKey: 'test-site-key',
                pageUrl: 'https://example.com',
            };

            await expect(bypassService.solveCaptcha(challenge)).rejects.toThrow(BypassException);
        });
    });

    describe('bypassCloudflare', () => {
        it('should return failure when cloudflare bypass is disabled', async () => {
            const result = await bypassService.bypassCloudflare('https://example.com');

            expect(result.success).toBe(false);
            expect(result.method).toBe('none');
            expect(result.error).toBe('Cloudflare bypass is disabled');
        });
    });

    describe('withRetry', () => {
        it('should succeed on first attempt', async () => {
            const operation = async () => 'success';

            const result = await bypassService.withRetry(operation, 'test operation');
            expect(result).toBe('success');
        });

        it('should retry on failure and eventually succeed', async () => {
            let attempts = 0;
            const operation = async () => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('Temporary failure');
                }
                return 'success';
            };

            const result = await bypassService.withRetry(operation, 'test operation');
            expect(result).toBe('success');
            expect(attempts).toBe(2);
        });

        it('should not retry non-retryable errors', async () => {
            const operation = async () => {
                throw new BypassException(
                    BypassError.INVALID_CHALLENGE,
                    'Invalid challenge',
                    false // not retryable
                );
            };

            await expect(bypassService.withRetry(operation, 'test operation')).rejects.toThrow(BypassException);
        });
    });
});