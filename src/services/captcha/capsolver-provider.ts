import axios from 'axios';
import { CaptchaProvider, CaptchaChallenge, CaptchaSolution, BypassError, BypassException } from '../../types/bypass';

interface CapSolverTask {
    type: string;
    websiteURL: string;
    websiteKey: string;
    pageAction?: string;
    minScore?: number;
    data?: string;
}

interface CapSolverResponse {
    errorId: number;
    errorCode?: string;
    errorDescription?: string;
    taskId?: string;
    status?: string;
    solution?: {
        gRecaptchaResponse?: string;
        token?: string;
    };
}

export class CapSolverProvider implements CaptchaProvider {
    private apiKey: string;
    private baseUrl = 'https://api.capsolver.com';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async solve(challenge: CaptchaChallenge): Promise<CaptchaSolution> {
        const startTime = Date.now();

        try {
            const task = this.createTask(challenge);
            const taskId = await this.submitTask(task);
            const solution = await this.waitForSolution(taskId);

            const solveTime = Date.now() - startTime;

            return {
                token: solution.gRecaptchaResponse || solution.token || '',
                cost: 0.002, // Approximate cost for CapSolver
                solveTime,
            };
        } catch (error: any) {
            if (error.message?.includes('INSUFFICIENT_BALANCE')) {
                throw new BypassException(
                    BypassError.INSUFFICIENT_BALANCE,
                    'Insufficient balance in CapSolver account',
                    false
                );
            }

            if (error.message?.includes('timeout')) {
                throw new BypassException(
                    BypassError.CAPTCHA_TIMEOUT,
                    'Captcha solving timed out',
                    true
                );
            }

            throw new BypassException(
                BypassError.CAPTCHA_UNSOLVABLE,
                `CapSolver error: ${error.message}`,
                true
            );
        }
    }

    private createTask(challenge: CaptchaChallenge): CapSolverTask {
        switch (challenge.type) {
            case 'recaptcha_v2':
                return {
                    type: 'ReCaptchaV2TaskProxyLess',
                    websiteURL: challenge.pageUrl,
                    websiteKey: challenge.siteKey,
                };

            case 'recaptcha_v3':
                return {
                    type: 'ReCaptchaV3TaskProxyLess',
                    websiteURL: challenge.pageUrl,
                    websiteKey: challenge.siteKey,
                    pageAction: challenge.action || 'verify',
                    minScore: challenge.minScore || 0.3,
                };

            case 'hcaptcha':
                return {
                    type: 'HCaptchaTaskProxyLess',
                    websiteURL: challenge.pageUrl,
                    websiteKey: challenge.siteKey,
                };

            case 'turnstile':
                return {
                    type: 'AntiTurnstileTaskProxyLess',
                    websiteURL: challenge.pageUrl,
                    websiteKey: challenge.siteKey,
                    data: challenge.data,
                };

            default:
                throw new BypassException(
                    BypassError.INVALID_CHALLENGE,
                    `Unsupported captcha type: ${challenge.type}`,
                    false
                );
        }
    }

    private async submitTask(task: CapSolverTask): Promise<string> {
        const response = await axios.post<CapSolverResponse>(`${this.baseUrl}/createTask`, {
            clientKey: this.apiKey,
            task,
        });

        if (response.data.errorId !== 0) {
            throw new Error(response.data.errorDescription || 'Unknown error');
        }

        return response.data.taskId!;
    }

    private async waitForSolution(taskId: string, timeout: number = 120000): Promise<any> {
        const startTime = Date.now();
        const pollInterval = 3000;

        while (Date.now() - startTime < timeout) {
            const response = await axios.post<CapSolverResponse>(`${this.baseUrl}/getTaskResult`, {
                clientKey: this.apiKey,
                taskId,
            });

            if (response.data.errorId !== 0) {
                throw new Error(response.data.errorDescription || 'Unknown error');
            }

            if (response.data.status === 'ready') {
                return response.data.solution;
            }

            if (response.data.status === 'failed') {
                throw new Error('Task failed');
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error('Timeout waiting for solution');
    }

    async getBalance(): Promise<number> {
        try {
            const response = await axios.post(`${this.baseUrl}/getBalance`, {
                clientKey: this.apiKey,
            });

            if (response.data.errorId !== 0) {
                throw new Error(response.data.errorDescription || 'Unknown error');
            }

            return response.data.balance;
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
            await axios.post(`${this.baseUrl}/reportIncorrect`, {
                clientKey: this.apiKey,
                taskId: captchaId,
            });
            return true;
        } catch (error) {
            return false;
        }
    }
}