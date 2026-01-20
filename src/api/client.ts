/**
 * API client for agy-top
 * Handles communication with zero-api backend
 */

import axios, { type AxiosInstance } from 'axios';
import https from 'https';
import { getApiUrl, getAuthToken } from '../utils/config.js';
import type {
    UsageSubmission,
    SubmissionResponse,
    LeaderboardData,
    UserInfo,
} from '../types/index.js';

let publicClient: AxiosInstance | null = null;
let authClient: AxiosInstance | null = null;

/**
 * Create HTTPS agent with SSL verification handling
 */
function createHttpsAgent() {
    // Allow skipping SSL verification via environment variable (for development)
    const skipSSLVerify = process.env.AGY_SKIP_SSL_VERIFY === 'true';
    
    // Create agent with default settings - let Node.js handle TLS negotiation
    // Don't restrict to specific TLS version as it may cause issues with modern certificates
    const agentOptions: https.AgentOptions = {
        rejectUnauthorized: !skipSSLVerify,
        // Use default keepAlive settings for better performance
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 50,
        maxFreeSockets: 10,
    };
    
    return new https.Agent(agentOptions);
}

/**
 * Get public API client (no auth required)
 */
export function getPublicApiClient(): AxiosInstance {
    if (!publicClient) {
        publicClient = axios.create({
            baseURL: getApiUrl(),
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'X-Client': 'agy-top',
            },
            httpsAgent: createHttpsAgent(),
        });

        // Add error interceptor to provide better error messages
        publicClient.interceptors.response.use(
            (response) => response,
            (error) => {
                // Check for SSL/TLS certificate errors
                const isSSLError = error.code === 'CERT_HAS_EXPIRED' || 
                    error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
                    error.code === 'CERT_SIGNATURE_FAILURE' ||
                    error.code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
                    error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
                    error.code === 'UNABLE_TO_GET_ISSUER_CERT' ||
                    error.code === 'UNABLE_TO_GET_CRL' ||
                    error.code === 'UNABLE_TO_DECRYPT_CERT_SIGNATURE' ||
                    error.code === 'UNABLE_TO_DECRYPT_CRL_SIGNATURE' ||
                    error.code === 'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY' ||
                    error.code === 'CERT_CHAIN_TOO_LONG' ||
                    error.code === 'CERT_REVOKED' ||
                    error.code === 'INVALID_CA' ||
                    error.code === 'PATH_LENGTH_EXCEEDED' ||
                    error.code === 'INVALID_PURPOSE' ||
                    error.code === 'CERT_UNTRUSTED' ||
                    error.code === 'CERT_REJECTED' ||
                    error.message?.includes('certificate') ||
                    error.message?.includes('SSL') ||
                    error.message?.includes('TLS') ||
                    error.message?.includes('certificate verification') ||
                    error.message?.includes('cert') ||
                    (error.response === undefined && error.request !== undefined); // Network errors without response
                
                if (isSSLError) {
                    const runtime = typeof process !== 'undefined' && typeof process.versions?.bun !== 'undefined' ? 'Bun' : 'Node.js';
                    const enhancedError = new Error(
                        `SSL Certificate Error: ${error.message || error.code || 'unknown certificate verification error'}\n` +
                        `Runtime: ${runtime}\n` +
                        `API URL: ${getApiUrl()}\n` +
                        `\nPossible solutions:\n` +
                        `1. If you're in a development environment, set AGY_SKIP_SSL_VERIFY=true\n` +
                        `2. Check your system's CA certificates are up to date\n` +
                        `3. Verify the API server's certificate is valid\n` +
                        `\nNote: Skipping SSL verification should only be used in development, not in production.`
                    );
                    enhancedError.cause = error;
                    throw enhancedError;
                }
                throw error;
            }
        );
    }
    return publicClient;
}

/**
 * Get authenticated API client
 */
export function getApiClient(): AxiosInstance {
    if (!authClient) {
        authClient = axios.create({
            baseURL: getApiUrl(),
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'X-Client': 'agy-top',
            },
            httpsAgent: createHttpsAgent(),
        });

        // Add auth interceptor
        authClient.interceptors.request.use((config) => {
            const token = getAuthToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });

        // Add error interceptor to provide better error messages
        authClient.interceptors.response.use(
            (response) => response,
            (error) => {
                // Check for SSL/TLS certificate errors
                const isSSLError = error.code === 'CERT_HAS_EXPIRED' || 
                    error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
                    error.code === 'CERT_SIGNATURE_FAILURE' ||
                    error.code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
                    error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
                    error.code === 'UNABLE_TO_GET_ISSUER_CERT' ||
                    error.code === 'UNABLE_TO_GET_CRL' ||
                    error.code === 'UNABLE_TO_DECRYPT_CERT_SIGNATURE' ||
                    error.code === 'UNABLE_TO_DECRYPT_CRL_SIGNATURE' ||
                    error.code === 'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY' ||
                    error.code === 'CERT_CHAIN_TOO_LONG' ||
                    error.code === 'CERT_REVOKED' ||
                    error.code === 'INVALID_CA' ||
                    error.code === 'PATH_LENGTH_EXCEEDED' ||
                    error.code === 'INVALID_PURPOSE' ||
                    error.code === 'CERT_UNTRUSTED' ||
                    error.code === 'CERT_REJECTED' ||
                    error.message?.includes('certificate') ||
                    error.message?.includes('SSL') ||
                    error.message?.includes('TLS') ||
                    error.message?.includes('certificate verification') ||
                    error.message?.includes('cert') ||
                    (error.response === undefined && error.request !== undefined); // Network errors without response
                
                if (isSSLError) {
                    const runtime = typeof process !== 'undefined' && typeof process.versions?.bun !== 'undefined' ? 'Bun' : 'Node.js';
                    const enhancedError = new Error(
                        `SSL Certificate Error: ${error.message || error.code || 'unknown certificate verification error'}\n` +
                        `Runtime: ${runtime}\n` +
                        `API URL: ${getApiUrl()}\n` +
                        `\nPossible solutions:\n` +
                        `1. If you're in a development environment, set AGY_SKIP_SSL_VERIFY=true\n` +
                        `2. Check your system's CA certificates are up to date\n` +
                        `3. Verify the API server's certificate is valid\n` +
                        `\nNote: Skipping SSL verification should only be used in development, not in production.`
                    );
                    enhancedError.cause = error;
                    throw enhancedError;
                }
                throw error;
            }
        );
    }
    return authClient;
}

/**
 * Reset API clients (call after auth changes)
 */
export function resetApiClients(): void {
    publicClient = null;
    authClient = null;
}

/**
 * API client class for agy-top
 */
export class ApiClient {
    /**
     * Submit usage data
     */
    static async submitUsage(data: UsageSubmission): Promise<SubmissionResponse> {
        const client = getApiClient();
        const response = await client.post<SubmissionResponse>('/agy/usage/submit', data);
        return response.data;
    }

    /**
     * Get user's usage history
     */
    static async getMyUsage(params?: {
        period?: 'daily' | 'weekly' | 'monthly';
        limit?: number;
    }): Promise<{ records: any[]; total: number }> {
        const client = getApiClient();
        const response = await client.get('/agy/usage/my', { params });
        return response.data;
    }

    /**
     * Get leaderboard
     */
    static async getLeaderboard(params?: {
        period?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
        limit?: number;
    }): Promise<LeaderboardData> {
        const client = getPublicApiClient();
        const response = await client.get<LeaderboardData>('/agy/leaderboard', { params });
        return response.data;
    }

    /**
     * Get user's current rank
     */
    static async getMyRank(period?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time'): Promise<{
        rank: number;
        totalTokens: number;
        totalParticipants: number;
    }> {
        const client = getApiClient();
        const response = await client.get('/agy/rank', { params: { period } });
        return response.data;
    }

    /**
     * Get current user info
     */
    static async getCurrentUser(): Promise<UserInfo | null> {
        try {
            const client = getApiClient();
            const response = await client.get<{ user: UserInfo } | UserInfo>('/user/profile');
            const data = response.data;
            if ('user' in data) {
                return { ...data.user, tier: 'free' };
            }
            return { ...data, tier: 'free' };
        } catch {
            return null;
        }
    }

    /**
     * Validate token
     */
    static async validateToken(): Promise<boolean> {
        try {
            const user = await this.getCurrentUser();
            return user !== null;
        } catch {
            return false;
        }
    }

    /**
     * Health check
     */
    static async healthCheck(): Promise<boolean> {
        try {
            const client = getPublicApiClient();
            await client.get('/agy/health');
            return true;
        } catch {
            return false;
        }
    }
}
