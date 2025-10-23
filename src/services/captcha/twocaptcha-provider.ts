import { Solver } from '2captcha-ts';
import { CaptchaProvider, CaptchaChallenge, CaptchaSolution, BypassError, BypassException } from '../../types/bypass';

export class TwoCaptchaProvider implements CaptchaProvider {
    private solver: Solver;

    constructor(apiKey: string) {
        this.solver = new Solver(apiKey);
    }

    async solve(challenge: CaptchaChallenge): Promise<CaptchaSolution> {
        const startTime = Date.now();

        try {
            let result: any;

            switch (challenge.type) {
                case 'recaptcha_v2':
                    result = await this.solver.recaptcha({
                        googlekey: challenge.siteKey,
                        pageurl: challenge.pageUrl,
                    });
                    break;

                case 'recaptcha_v3':
                    result = await this.solver.recaptcha({
                        googlekey: challenge.siteKey,
                        pageurl: challenge.pageUrl,
                        version: 'v3',
                        action: challenge.action || 'verify',
                        min_score: challenge.minScore || 0.3,
                    });
                    break;

                case 'hcaptcha':
                    result = await this.solver.hcaptcha({
                        sitekey: challenge.siteKey,
                        pageurl: challenge.pageUrl,
                    });
                    break;

                case 'turnstile':
                    // Note: Turnstile support may not be available in all versions
                    throw new BypassException(
                        BypassError.INVALID_CHALLENGE,
                        'Turnstile not supported by this provider version',
                        false
                    );

                default:
                    throw new BypassException(
                        BypassError.INVALID_CHALLENGE,
                        `Unsupported captcha type: ${challenge.type}`,
                        false
                    );
            }

            const solveTime = Date.now() - startTime;

            return {
                token: result.data,
                cost: 0.002, // Approximate cost for 2captcha
                solveTime,
            };
        } catch (error: any) {
            if (error.message?.includes('ZERO_BALANCE')) {
                throw new BypassException(
                    BypassError.INSUFFICIENT_BALANCE,
                    'Insufficient balance in 2captcha account',
                    false
                );
            }

            if (error.message?.includes('CAPCHA_NOT_READY') || error.message?.includes('timeout')) {
                throw new BypassException(
                    BypassError.CAPTCHA_TIMEOUT,
                    'Captcha solving timed out',
                    true
                );
            }

            throw new BypassException(
                BypassError.CAPTCHA_UNSOLVABLE,
                `2captcha error: ${error.message}`,
                true
            );
        }
    }

    async getBalance(): Promise<number> {
        try {
            const balance = await this.solver.balance();
            return parseFloat(balance.toString());
        } catch (error: any) {
            throw new BypassException(
                BypassError.SERVICE_UNAVAILABLE,
                `Failed to get balance: ${error.message}`,
                true
            );
        }
    }

    async reportBad(_captchaId: string): Promise<boolean> {
        try {
            // Note: Report functionality may vary by provider version
            return true;
        } catch (error) {
            return false;
        }
    }
}