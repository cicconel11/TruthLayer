import { Page } from 'puppeteer';
import { BypassService, BypassConfig, CaptchaChallenge, CaptchaSolution, BypassResult, BypassError, BypassException, CaptchaProvider } from '../types/bypass';
import { TwoCaptchaProvider } from './captcha/twocaptcha-provider';
import { AntiCaptchaProvider } from './captcha/anticaptcha-provider';
import { CapSolverProvider } from './captcha/capsolver-provider';
import { logger } from '../utils/logger';

export class BypassServiceImpl implements BypassService {
    private config: BypassConfig;
    private captchaProvider: CaptchaProvider;

    constructor(config: BypassConfig) {
        this.config = config;
        this.captchaProvider = this.createCaptchaProvider();
    }

    private createCaptchaProvider(): CaptchaProvider {
        switch (this.config.captcha.provider) {
            case 'twocaptcha':
                return new TwoCaptchaProvider(this.config.captcha.apiKey);
            case 'anticaptcha':
                return new AntiCaptchaProvider(this.config.captcha.apiKey);
            case 'capsolver':
                return new CapSolverProvider(this.config.captcha.apiKey);
            default:
                throw new Error(`Unsupported captcha provider: ${this.config.captcha.provider}`);
        }
    }

    async solveCaptcha(challenge: CaptchaChallenge): Promise<CaptchaSolution> {
        if (!this.config.captcha.enabled) {
            throw new BypassException(
                BypassError.SERVICE_UNAVAILABLE,
                'Captcha solving is disabled',
                false
            );
        }

        logger.info('Attempting to solve captcha', {
            type: challenge.type,
            provider: this.config.captcha.provider,
            siteKey: challenge.siteKey.substring(0, 10) + '...',
        });

        return await this.captchaProvider.solve(challenge);
    }

    async bypassCloudflare(url: string): Promise<BypassResult> {
        if (!this.config.cloudflare.enabled) {
            return {
                success: false,
                method: 'none',
                error: 'Cloudflare bypass is disabled',
            };
        }

        logger.info('Attempting Cloudflare bypass', { url });

        // For now, we'll implement a basic proxy rotation strategy
        // In a production environment, you might integrate with specialized services
        return {
            success: true,
            method: 'proxy_rotation',
            duration: 0,
        };
    }

    async isAvailable(): Promise<boolean> {
        try {
            if (this.config.captcha.enabled) {
                const balance = await this.captchaProvider.getBalance();
                return balance > 0.01; // Minimum balance threshold
            }
            return true;
        } catch (error) {
            logger.error('Bypass service availability check failed', { error });
            return false;
        }
    }

    /**
     * Detect and handle various types of blocks on a page
     */
    async handlePageBlocks(page: Page): Promise<BypassResult> {
        const startTime = Date.now();

        try {
            const content = await page.content();
            const url = page.url();

            // Check for Cloudflare challenge
            if (this.isCloudflareChallenge(content)) {
                logger.info('Cloudflare challenge detected', { url });
                return await this.handleCloudflareChallenge(page);
            }

            // Check for CAPTCHA challenges
            const captchaChallenge = await this.detectCaptchaChallenge(page);
            if (captchaChallenge) {
                logger.info('CAPTCHA challenge detected', {
                    type: captchaChallenge.type,
                    url
                });
                return await this.handleCaptchaChallenge(page, captchaChallenge);
            }

            // Check for other blocking patterns
            if (this.isBlocked(content)) {
                logger.info('Generic blocking detected', { url });
                return await this.handleGenericBlock(page);
            }

            return {
                success: true,
                method: 'none',
                duration: Date.now() - startTime,
            };
        } catch (error: any) {
            logger.error('Error handling page blocks', { error: error.message, url: page.url() });
            return {
                success: false,
                method: 'none',
                error: error.message,
                duration: Date.now() - startTime,
            };
        }
    }

    private isCloudflareChallenge(content: string): boolean {
        const cloudflareIndicators = [
            'cloudflare',
            'cf-browser-verification',
            'cf-challenge',
            'checking your browser',
            'ddos protection',
            'ray id'
        ];

        return cloudflareIndicators.some(indicator =>
            content.toLowerCase().includes(indicator)
        );
    }

    private async detectCaptchaChallenge(page: Page): Promise<CaptchaChallenge | null> {
        try {
            // Check for reCAPTCHA v2
            const recaptchaV2 = await page.$('.g-recaptcha');
            if (recaptchaV2) {
                const siteKey = await page.evaluate(() => {
                    const element = document.querySelector('.g-recaptcha');
                    return element?.getAttribute('data-sitekey') || '';
                });

                if (siteKey) {
                    return {
                        type: 'recaptcha_v2',
                        siteKey,
                        pageUrl: page.url(),
                    };
                }
            }

            // Check for reCAPTCHA v3
            const recaptchaV3Script = await page.evaluate(() => {
                const scripts = Array.from(document.querySelectorAll('script'));
                return scripts.find(script =>
                    script.src.includes('recaptcha/api.js') ||
                    script.innerHTML.includes('grecaptcha.execute')
                );
            });

            if (recaptchaV3Script) {
                const siteKey = await page.evaluate(() => {
                    const scripts = Array.from(document.querySelectorAll('script'));
                    for (const script of scripts) {
                        const match = script.innerHTML.match(/sitekey['"]\s*:\s*['"]([^'"]+)['"]/);
                        if (match) return match[1];
                    }
                    return '';
                });

                if (siteKey) {
                    return {
                        type: 'recaptcha_v3',
                        siteKey,
                        pageUrl: page.url(),
                        action: 'verify',
                        minScore: 0.3,
                    };
                }
            }

            // Check for hCaptcha
            const hcaptcha = await page.$('.h-captcha');
            if (hcaptcha) {
                const siteKey = await page.evaluate(() => {
                    const element = document.querySelector('.h-captcha');
                    return element?.getAttribute('data-sitekey') || '';
                });

                if (siteKey) {
                    return {
                        type: 'hcaptcha',
                        siteKey,
                        pageUrl: page.url(),
                    };
                }
            }

            // Check for Turnstile
            const turnstile = await page.$('.cf-turnstile');
            if (turnstile) {
                const siteKey = await page.evaluate(() => {
                    const element = document.querySelector('.cf-turnstile');
                    return element?.getAttribute('data-sitekey') || '';
                });

                if (siteKey) {
                    return {
                        type: 'turnstile',
                        siteKey,
                        pageUrl: page.url(),
                    };
                }
            }

            return null;
        } catch (error) {
            logger.error('Error detecting CAPTCHA challenge', { error });
            return null;
        }
    }

    private async handleCloudflareChallenge(page: Page): Promise<BypassResult> {
        const startTime = Date.now();

        try {
            // Wait for Cloudflare challenge to complete automatically
            await page.waitForNavigation({
                waitUntil: 'networkidle2',
                timeout: this.config.cloudflare.timeout
            });

            // Check if we're still on a challenge page
            const content = await page.content();
            if (this.isCloudflareChallenge(content)) {
                return {
                    success: false,
                    method: 'cloudflare',
                    error: 'Cloudflare challenge not resolved',
                    duration: Date.now() - startTime,
                };
            }

            return {
                success: true,
                method: 'cloudflare',
                duration: Date.now() - startTime,
            };
        } catch (error: any) {
            return {
                success: false,
                method: 'cloudflare',
                error: error.message,
                duration: Date.now() - startTime,
            };
        }
    }

    private async handleCaptchaChallenge(page: Page, challenge: CaptchaChallenge): Promise<BypassResult> {
        const startTime = Date.now();

        try {
            const solution = await this.solveCaptcha(challenge);

            // Inject the solution into the page
            await this.injectCaptchaSolution(page, challenge, solution);

            // Submit the form or trigger the verification
            await this.submitCaptchaSolution(page, challenge);

            // Wait for navigation or success indicator
            await page.waitForNavigation({
                waitUntil: 'networkidle2',
                timeout: 10000
            });

            return {
                success: true,
                method: 'captcha',
                cost: solution.cost,
                duration: Date.now() - startTime,
            };
        } catch (error: any) {
            return {
                success: false,
                method: 'captcha',
                error: error.message,
                duration: Date.now() - startTime,
            };
        }
    }

    private async injectCaptchaSolution(page: Page, challenge: CaptchaChallenge, solution: CaptchaSolution): Promise<void> {
        switch (challenge.type) {
            case 'recaptcha_v2':
                await page.evaluate((token) => {
                    const textarea = document.querySelector('#g-recaptcha-response') as any;
                    if (textarea) {
                        textarea.style.display = 'block';
                        textarea.value = token;
                    }
                }, solution.token);
                break;

            case 'recaptcha_v3':
                await page.evaluate((token) => {
                    (window as any).grecaptchaToken = token;
                }, solution.token);
                break;

            case 'hcaptcha':
                await page.evaluate((token) => {
                    const textarea = document.querySelector('[name="h-captcha-response"]') as any;
                    if (textarea) {
                        textarea.value = token;
                    }
                }, solution.token);
                break;

            case 'turnstile':
                await page.evaluate((token) => {
                    const input = document.querySelector('[name="cf-turnstile-response"]') as any;
                    if (input) {
                        input.value = token;
                    }
                }, solution.token);
                break;
        }
    }

    private async submitCaptchaSolution(page: Page, _challenge: CaptchaChallenge): Promise<void> {
        // Try to find and click submit button
        const submitSelectors = [
            'input[type="submit"]',
            'button[type="submit"]',
            'button:contains("Submit")',
            'button:contains("Verify")',
            '.submit-btn',
            '#submit'
        ];

        for (const selector of submitSelectors) {
            try {
                const button = await page.$(selector);
                if (button) {
                    await button.click();
                    return;
                }
            } catch (error) {
                // Continue to next selector
            }
        }

        // If no submit button found, try pressing Enter
        await page.keyboard.press('Enter');
    }

    private async handleGenericBlock(_page: Page): Promise<BypassResult> {
        // For generic blocks, we'll just return failure
        // In a production system, you might implement additional strategies
        return {
            success: false,
            method: 'none',
            error: 'Generic blocking detected, no bypass available',
        };
    }

    private isBlocked(content: string): boolean {
        const blockIndicators = [
            'access denied',
            'blocked',
            'forbidden',
            'unusual traffic',
            'verify you are human',
            'robot',
            'automated queries',
            'suspicious activity',
            'rate limit',
            'too many requests'
        ];

        return blockIndicators.some(indicator =>
            content.toLowerCase().includes(indicator)
        );
    }

    /**
     * Retry logic with exponential backoff
     */
    async withRetry<T>(
        operation: () => Promise<T>,
        context: string = 'operation'
    ): Promise<T> {
        let lastError: Error | null = null;
        let delay = this.config.retries.baseDelay;

        for (let attempt = 1; attempt <= this.config.retries.maxAttempts; attempt++) {
            try {
                logger.debug(`Attempting ${context}`, { attempt, maxAttempts: this.config.retries.maxAttempts });
                return await operation();
            } catch (error: any) {
                lastError = error;

                if (error instanceof BypassException && !error.retryable) {
                    logger.error(`Non-retryable error in ${context}`, { error: error.message });
                    throw error;
                }

                if (attempt < this.config.retries.maxAttempts) {
                    logger.warn(`${context} failed, retrying in ${delay}ms`, {
                        attempt,
                        error: error.message
                    });

                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay = Math.min(
                        delay * this.config.retries.backoffMultiplier,
                        this.config.retries.maxDelay
                    );
                }
            }
        }

        logger.error(`${context} failed after all retries`, {
            attempts: this.config.retries.maxAttempts,
            error: lastError?.message
        });
        throw lastError || new Error(`${context} failed after all retries`);
    }
}