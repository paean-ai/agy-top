/**
 * Type definitions for agy-top
 */

export interface UsageStats {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    sessionCount: number;
    modelBreakdown: ModelUsage[];
    periodStart: Date;
    periodEnd: Date;
}

export interface ModelUsage {
    model: string;
    inputTokens: number;
    outputTokens: number;
    sessions: number;
    estimatedCost: number;
}

export interface DashboardOptions {
    rankMode: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
    debug: boolean;
}

export interface LeaderboardEntry {
    rank: number;
    displayName: string;
    totalTokens: number;
    sessionCount: number;
    tier: string;
    isCurrentUser: boolean;
}

export interface LeaderboardData {
    period: 'daily' | 'weekly' | 'monthly' | 'all_time';
    periodDate: string;
    entries: LeaderboardEntry[];
    userRank?: number;
    totalParticipants: number;
}

export interface UsageSubmission {
    periodStart: string;
    periodEnd: string;
    inputTokens: number;
    outputTokens: number;
    sessionCount: number;
    modelBreakdown: Record<string, {
        inputTokens: number;
        outputTokens: number;
        sessions: number;
    }>;
    cumulativeChecksum: string;
    previousChecksum: string;
    clientVersion: string;
}

export interface SubmissionResponse {
    success: boolean;
    trustScore: number;
    rank?: number;
    message?: string;
}

export interface UserInfo {
    id: number;
    email: string;
    name?: string;
    tier: string;
}

export interface AuthConfig {
    token?: string;
    userId?: number;
    email?: string;
}

export interface DailyUsage {
    date: string;
    tokens: number;
}

export interface WeeklyTrend {
    day: string;
    percentage: number;
}
