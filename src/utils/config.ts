/**
 * Configuration utilities for agy-top
 */

import Conf from 'conf';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { AuthConfig } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ConfigSchema {
    auth: AuthConfig;
    apiUrl: string;
    webUrl: string;
    installationId: string;
    lastSubmission?: {
        timestamp: string;
        checksum: string;
        totalUsedInput?: number;
        totalUsedOutput?: number;
    };
}

const config = new Conf<ConfigSchema>({
    projectName: 'agy-top',
    defaults: {
        auth: {},
        apiUrl: process.env.AGY_API_URL || 'https://api.paean.ai',
        webUrl: process.env.AGY_WEB_URL || 'https://app.paean.ai',
        installationId: generateInstallationId(),
    },
});

/**
 * Generate a unique installation ID
 */
function generateInstallationId(): string {
    return `agy-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Get the config file path
 */
export function getConfigPath(): string {
    return config.path;
}

/**
 * Get a config value
 */
export function getConfigValue<K extends keyof ConfigSchema>(key: K): ConfigSchema[K] {
    return config.get(key);
}

/**
 * Set a config value
 */
export function setConfigValue<K extends keyof ConfigSchema>(key: K, value: ConfigSchema[K]): void {
    config.set(key, value);
}

/**
 * Get the API URL
 */
export function getApiUrl(): string {
    return config.get('apiUrl');
}

/**
 * Get the web URL
 */
export function getWebUrl(): string {
    return config.get('webUrl');
}

/**
 * Get the installation ID
 */
export function getInstallationId(): string {
    let id = config.get('installationId');
    if (!id) {
        id = generateInstallationId();
        config.set('installationId', id);
    }
    return id;
}

/**
 * Store authentication data
 */
export function storeAuth(auth: AuthConfig): void {
    config.set('auth', auth);
}

/**
 * Clear authentication data
 */
export function clearAuth(): void {
    config.set('auth', {});
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
    const auth = config.get('auth');
    return !!(auth && auth.token);
}

/**
 * Get stored auth token
 */
export function getAuthToken(): string | undefined {
    return config.get('auth')?.token;
}

/**
 * Get stored user ID
 */
export function getUserId(): number | undefined {
    return config.get('auth')?.userId;
}

/**
 * Get stored email
 */
export function getEmail(): string | undefined {
    return config.get('auth')?.email;
}

/**
 * Store last submission info
 */
export function storeLastSubmission(data: { timestamp: string; checksum: string; totalUsedInput: number; totalUsedOutput: number }): void {
    config.set('lastSubmission', data);
}

/**
 * Get last submission info
 */
export function getLastSubmission(): { timestamp: string; checksum: string; totalUsedInput?: number; totalUsedOutput?: number } | undefined {
    return config.get('lastSubmission');
}
