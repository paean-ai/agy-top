/**
 * API client for agy-top
 * Handles communication with zero-api backend
 */

import axios, { type AxiosInstance } from 'axios';
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
        });
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
        });

        // Add auth interceptor
        authClient.interceptors.request.use((config) => {
            const token = getAuthToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });
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
        period?: 'daily' | 'weekly' | 'monthly' | 'all_time';
        limit?: number;
    }): Promise<LeaderboardData> {
        const client = getPublicApiClient();
        const response = await client.get<LeaderboardData>('/agy/leaderboard', { params });
        return response.data;
    }

    /**
     * Get user's current rank
     */
    static async getMyRank(period?: 'daily' | 'weekly' | 'monthly' | 'all_time'): Promise<{
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
