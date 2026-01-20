/**
 * Quota Service
 * 
 * Fetches quota and usage data from Antigravity Language Server API.
 * Mirrors the API calls made by antigravity-panel's quota.service.ts
 */

import { ServerInfo } from './server-detector.js';

export interface ModelQuotaInfo {
    label: string;
    modelId: string;
    remainingPercentage: number;
    isExhausted: boolean;
    resetTime: Date;
    timeUntilReset: string;
}

export interface PromptCreditsInfo {
    available: number;
    monthly: number;
    usedPercentage: number;
    remainingPercentage: number;
}

export interface FlowCreditsInfo {
    available: number;
    monthly: number;
    usedPercentage: number;
    remainingPercentage: number;
}

export interface TokenUsageInfo {
    promptCredits?: PromptCreditsInfo;
    flowCredits?: FlowCreditsInfo;
    totalAvailable: number;
    totalMonthly: number;
    overallRemainingPercentage: number;
}

export interface UserInfo {
    name?: string;
    email?: string;
    tier?: string;
    planName?: string;
}

export interface QuotaSnapshot {
    timestamp: Date;
    promptCredits?: PromptCreditsInfo;
    flowCredits?: FlowCreditsInfo;
    tokenUsage?: TokenUsageInfo;
    userInfo?: UserInfo;
    models: ModelQuotaInfo[];
}

export interface QuotaFetchResult {
    success: boolean;
    snapshot?: QuotaSnapshot;
    error?: string;
}

/**
 * Fetch quota from Language Server
 */
export async function fetchQuota(server: ServerInfo): Promise<QuotaFetchResult> {
    try {
        const url = `http://127.0.0.1:${server.port}/exa.language_server_pb.LanguageServerService/GetUserStatus`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Connect-Protocol-Version': '1',
                'X-Codeium-Csrf-Token': server.csrfToken,
            },
            // Use wrapper_data format, same as antigravity-panel
            body: JSON.stringify({
                wrapper_data: {},
            }),
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                return {
                    success: false,
                    error: `Authentication failed (${response.status})`,
                };
            }
            return {
                success: false,
                error: `HTTP error ${response.status}`,
            };
        }

        const data = await response.json() as ServerUserStatusResponse;

        if (!data.userStatus) {
            return {
                success: false,
                error: 'Invalid response structure',
            };
        }

        const snapshot = parseResponse(data);
        return {
            success: true,
            snapshot,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch quota',
        };
    }
}

/**
 * Parse server response into QuotaSnapshot
 */
function parseResponse(data: ServerUserStatusResponse): QuotaSnapshot {
    const userStatus = data.userStatus;
    const planInfo = userStatus.planStatus?.planInfo;
    const availableCredits = userStatus.planStatus?.availablePromptCredits;
    const availableFlowCredits = userStatus.planStatus?.availableFlowCredits;

    // Parse Prompt Credits
    let promptCredits: PromptCreditsInfo | undefined;
    if (planInfo && availableCredits !== undefined) {
        const monthly = Number(planInfo.monthlyPromptCredits);
        const available = Number(availableCredits);
        if (monthly > 0) {
            promptCredits = {
                available,
                monthly,
                usedPercentage: ((monthly - available) / monthly) * 100,
                remainingPercentage: (available / monthly) * 100,
            };
        }
    }

    // Parse Flow Credits
    let flowCredits: FlowCreditsInfo | undefined;
    if (planInfo?.monthlyFlowCredits && availableFlowCredits !== undefined) {
        const monthly = Number(planInfo.monthlyFlowCredits);
        const available = Number(availableFlowCredits);
        if (monthly > 0) {
            flowCredits = {
                available,
                monthly,
                usedPercentage: ((monthly - available) / monthly) * 100,
                remainingPercentage: (available / monthly) * 100,
            };
        }
    }

    // Build combined token usage info
    let tokenUsage: TokenUsageInfo | undefined;
    if (promptCredits || flowCredits) {
        const totalAvailable = (promptCredits?.available || 0) + (flowCredits?.available || 0);
        const totalMonthly = (promptCredits?.monthly || 0) + (flowCredits?.monthly || 0);
        tokenUsage = {
            promptCredits,
            flowCredits,
            totalAvailable,
            totalMonthly,
            overallRemainingPercentage: totalMonthly > 0 ? (totalAvailable / totalMonthly) * 100 : 0,
        };
    }

    // Extract user subscription info
    const userTier = userStatus.userTier;
    const userInfo: UserInfo | undefined = userStatus.name || userTier ? {
        name: userStatus.name,
        email: userStatus.email,
        tier: userTier?.name || planInfo?.teamsTier,
        planName: planInfo?.planName,
    } : undefined;

    // Parse model quotas
    const rawModels = userStatus.cascadeModelConfigData?.clientModelConfigs || [];
    const models: ModelQuotaInfo[] = rawModels
        .filter((m: RawModelConfig) => m.quotaInfo)
        .map((m: RawModelConfig) => {
            const resetTime = new Date(m.quotaInfo!.resetTime);
            const now = new Date();
            const diff = resetTime.getTime() - now.getTime();
            const remainingFraction = m.quotaInfo!.remainingFraction ?? 0;

            return {
                label: m.label,
                modelId: m.modelOrAlias?.model || 'unknown',
                remainingPercentage: remainingFraction * 100,
                isExhausted: remainingFraction === 0,
                resetTime,
                timeUntilReset: formatTime(diff),
            };
        });

    return { timestamp: new Date(), promptCredits, flowCredits, tokenUsage, userInfo, models };
}

function formatTime(ms: number): string {
    if (ms <= 0) return 'Ready';
    const mins = Math.ceil(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
}

// Server Response Types
interface RawModelConfig {
    label: string;
    modelOrAlias?: { model: string };
    quotaInfo?: {
        remainingFraction?: number;
        resetTime: string;
    };
}

interface ServerUserStatusResponse {
    userStatus: {
        name?: string;
        email?: string;
        userTier?: {
            id?: string;
            name?: string;
            description?: string;
        };
        planStatus?: {
            planInfo: {
                monthlyPromptCredits: number;
                monthlyFlowCredits?: number;
                planName?: string;
                teamsTier?: string;
            };
            availablePromptCredits: number;
            availableFlowCredits?: number;
        };
        cascadeModelConfigData?: {
            clientModelConfigs: RawModelConfig[];
        };
    };
}
