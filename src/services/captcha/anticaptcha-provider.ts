const AntiCaptcha = require('anticaptcha');
import { CaptchaProvider, CaptchaChallenge, CaptchaSolution, BypassError, BypassException } from '../../types/bypass';

export class AntiCaptchaProvider implements CaptchaProvider {
    private client: any;

    constructor(apiKey: string) {
        this.client = new AntiCaptcha(apiKey);
    }

    async solve(challenge: CaptchaChallenge): Promise<CaptchaSolution> {
        const startTime = Date.now();

        try {
            let result: any;

            switch (challenge.type) {
                case 'recaptcha_v2':
                    result = await this.client.createTask({
                        type: 'NoCaptchaTaskProxyless',
                        websiteURL: challenge.pageUrl,
                        websiteKey: challenge.siteKey,
                    });
                    break;

                case 'recaptcha_v3':
                    result = await this.client.createTask({
                        type: 'RecaptchaV3TaskProxyless',
                        websiteURL: challenge.pageUrl,
                        websiteKey: challenge.siteKey,
                        pageAction: challenge.action || 'verify',
                        minScore: challenge.minScore || 0.3,
                    });
                    break;

                case 'hcaptcha':
                    result = await this.client.createTask({
                        type: 'HCaptchaTaskProxyless',
                        websiteURL: challenge.pageUrl,
                        websiteKey: challenge.siteKey,
                    });
                    break;

                case 'turnstile':
                    result = await this.client.createTask({
                        type: 'TurnstileTaskProxyless',
                        websiteURL: challenge.pageUrl,
                        websiteKey: challenge.siteKey,
                        metadata: challenge.data ? { data: challenge.data } : undefined,
                    });
                    break;

                default:
                    throw new BypassException(
                        BypassError.INVALID_CHALLENGE,
                        `Unsupported captcha type: ${challenge.type}`,
                        false
                    );
            }

            const solveTime = Date.now() - startTime;

            return {
                token: result.solution.gRecaptchaResponse || result.solution.token,
                cost: 0.002, // Approximate cost for AntiCaptcha
                solveTime,
            };
        } catch (error: any) {
            if (error.message?.includes('ZERO_BALANCE') || error.message?.includes('insufficient funds')) {
                throw new BypassException(
                    BypassError.INSUFFICIENT_BALANCE,
                    'Insufficient balance in AntiCaptcha account',
                    false
                );
            }

            if (error.message?.includes('timeout') || error.message?.includes('TASK_TIMEOUT')) {
                throw new BypassException(
                    BypassError.CAPTCHA_TIMEOUT,
                    'Captcha solving timed out',
                    true
                );
            }

            throw new BypassException(
                BypassError.CAPTCHA_UNSOLVABLE,
                `AntiCaptcha error: ${error.message}`,
                true
            );
        }
    }

    async getBalance(): Promise<number> {
        try {
            const balance = await this.client.getBalance();
            return balance;
        } catch (error: any) {
            throw new BypassException(
                BypassError.SERVICE_UNAVAILABLE,
                `Failed to get balance: ${error.message}`,
                true
            );
        }
    }

    async reportBad(captchaId: string): Promise<boolean> {
        try {
            await this.client.reportIncorrectRecaptcha(captchaId);
            return true;
        } catch (error) {
            return false;
        }
    }
}