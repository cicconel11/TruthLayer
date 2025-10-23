/**
 * Type declarations for browser context code
 * This file provides type definitions for code that runs inside page.evaluate()
 */

declare global {
    interface Window {
        grecaptchaToken?: string;
    }
}