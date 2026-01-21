/**
 * Token Estimator for agy-top
 * 
 * Estimates token consumption based on model quota percentage changes
 * from Antigravity Language Server. Since the Language Server doesn't
 * provide actual token counts, we estimate based on:
 * - User tier (Ultra/Pro/Free) 
 * - Model category (Gemini Flash/Pro, Claude)
 * - Quota percentage delta
 */

import type { ModelQuotaInfo } from './quota-service.js';

/**
 * Model categories for quota tracking
 */
export type ModelCategory = 'gemini_flash' | 'gemini_pro' | 'claude' | 'unknown';

/**
 * Token quota per 5-hour window for each tier/model
 * Note: These are estimates based on industry research.
 * Antigravity doesn't publish exact quota limits.
 */
export interface TierQuotaConfig {
    gemini_flash: number;
    gemini_pro: number;
    claude: number;
}

/**
 * Tier-based quota configurations (tokens per 5-hour window)
 */
export const TIER_QUOTAS: Record<string, TierQuotaConfig> = {
    // Google AI Ultra - highest tier
    'Google AI Ultra': {
        gemini_flash: 1_000_000,   // ~1M tokens / 5h
        gemini_pro: 500_000,       // ~500K tokens / 5h
        claude: 300_000,           // ~300K tokens / 5h
    },
    // Google AI Pro - mid tier
    'Google AI Pro': {
        gemini_flash: 500_000,     // ~500K tokens / 5h
        gemini_pro: 250_000,       // ~250K tokens / 5h  
        claude: 150_000,           // ~150K tokens / 5h
    },
    // Free tier - weekly refresh, lower limits
    'Free': {
        gemini_flash: 100_000,     // ~100K tokens / week
        gemini_pro: 50_000,        // ~50K tokens / week
        claude: 30_000,            // ~30K tokens / week
    },
    // Default fallback
    'default': {
        gemini_flash: 200_000,
        gemini_pro: 100_000,
        claude: 60_000,
    },
};

/**
 * Tracked quota state per model
 */
export interface ModelQuotaState {
    modelId: string;
    category: ModelCategory;
    previousPercentage: number;
    currentPercentage: number;
    lastUpdated: Date;
}

/**
 * Accumulated token usage estimate
 */
export interface EstimatedTokenUsage {
    gemini_flash: number;
    gemini_pro: number;
    claude: number;
    total: number;
    lastUpdated: Date;
}

/**
 * Categorize model ID to a category
 */
export function categorizeModel(modelId: string): ModelCategory {
    const lower = modelId.toLowerCase();

    // Gemini Flash models
    if (lower.includes('flash') || lower.includes('gemini-2.0-flash') || lower.includes('gemini-3-flash')) {
        return 'gemini_flash';
    }

    // Gemini Pro models
    if (lower.includes('gemini') && (lower.includes('pro') || lower.includes('2.5') || lower.includes('exp'))) {
        return 'gemini_pro';
    }

    // Claude models
    if (lower.includes('claude') || lower.includes('anthropic')) {
        return 'claude';
    }

    // Default to flash for other Gemini models
    if (lower.includes('gemini')) {
        return 'gemini_flash';
    }

    return 'unknown';
}

/**
 * Get quota config for a tier
 */
export function getTierQuotaConfig(tier: string | undefined): TierQuotaConfig {
    if (!tier) return TIER_QUOTAS['default'];

    // Try exact match first
    if (TIER_QUOTAS[tier]) {
        return TIER_QUOTAS[tier];
    }

    // Try partial match
    const lowerTier = tier.toLowerCase();
    if (lowerTier.includes('ultra')) {
        return TIER_QUOTAS['Google AI Ultra'];
    }
    if (lowerTier.includes('pro')) {
        return TIER_QUOTAS['Google AI Pro'];
    }
    if (lowerTier.includes('free')) {
        return TIER_QUOTAS['Free'];
    }

    return TIER_QUOTAS['default'];
}

/**
 * Calculate estimated tokens consumed from quota delta
 * 
 * Logic: If quota drops from 80% to 60%, that's 20% consumed.
 * 20% of tier's 5-hour quota = estimated tokens consumed.
 */
export function estimateTokensFromDelta(
    previousPercentage: number,
    currentPercentage: number,
    category: ModelCategory,
    tier: string | undefined
): number {
    // Only count when quota decreases (tokens consumed)
    if (currentPercentage >= previousPercentage) {
        return 0;
    }

    // Handle quota reset (current > previous after reset)
    // In this case, we don't count as consumption
    if (currentPercentage > previousPercentage + 50) {
        return 0;
    }

    const deltaPercentage = previousPercentage - currentPercentage;
    const quotaConfig = getTierQuotaConfig(tier);

    // Get the quota for this category
    const categoryQuota = category === 'unknown'
        ? quotaConfig.gemini_flash  // Default to flash quota for unknown
        : quotaConfig[category];

    // Calculate tokens: deltaPercentage / 100 * totalQuota
    const estimatedTokens = Math.round((deltaPercentage / 100) * categoryQuota);

    return estimatedTokens;
}

/**
 * Token Estimator class for tracking and accumulating estimates
 */
export class TokenEstimator {
    private quotaHistory: Map<string, ModelQuotaState> = new Map();
    private accumulatedUsage: EstimatedTokenUsage = {
        gemini_flash: 0,
        gemini_pro: 0,
        claude: 0,
        total: 0,
        lastUpdated: new Date(),
    };

    constructor(initialUsage?: EstimatedTokenUsage) {
        if (initialUsage) {
            this.accumulatedUsage = { ...initialUsage };
        }
    }

    /**
     * Update with new model quota data and calculate consumption
     */
    updateFromModels(
        models: ModelQuotaInfo[],
        tier: string | undefined
    ): { tokensConsumed: number; breakdown: Record<ModelCategory, number> } {
        const breakdown: Record<ModelCategory, number> = {
            gemini_flash: 0,
            gemini_pro: 0,
            claude: 0,
            unknown: 0,
        };
        let totalConsumed = 0;

        for (const model of models) {
            const category = categorizeModel(model.modelId);
            const currentPercentage = model.remainingPercentage;

            // Get previous state
            const prevState = this.quotaHistory.get(model.modelId);
            const previousPercentage = prevState?.currentPercentage ?? currentPercentage;

            // Calculate delta
            const consumed = estimateTokensFromDelta(
                previousPercentage,
                currentPercentage,
                category,
                tier
            );

            if (consumed > 0) {
                breakdown[category] += consumed;
                totalConsumed += consumed;

                // Update accumulated usage
                if (category !== 'unknown') {
                    this.accumulatedUsage[category] += consumed;
                }
            }

            // Update history
            this.quotaHistory.set(model.modelId, {
                modelId: model.modelId,
                category,
                previousPercentage,
                currentPercentage,
                lastUpdated: new Date(),
            });
        }

        if (totalConsumed > 0) {
            this.accumulatedUsage.total += totalConsumed;
            this.accumulatedUsage.lastUpdated = new Date();
        }

        return { tokensConsumed: totalConsumed, breakdown };
    }

    /**
     * Get current accumulated usage
     */
    getAccumulatedUsage(): EstimatedTokenUsage {
        return { ...this.accumulatedUsage };
    }

    /**
     * Get serializable state for persistence
     */
    getState(): {
        quotaHistory: Array<[string, ModelQuotaState]>;
        accumulatedUsage: EstimatedTokenUsage;
    } {
        return {
            quotaHistory: Array.from(this.quotaHistory.entries()),
            accumulatedUsage: this.accumulatedUsage,
        };
    }

    /**
     * Restore from persisted state
     */
    static fromState(state: {
        quotaHistory?: Array<[string, {
            modelId: string;
            category: string;  // Accept string from JSON
            previousPercentage: number;
            currentPercentage: number;
            lastUpdated: Date;
        }]>;
        accumulatedUsage?: EstimatedTokenUsage;
    }): TokenEstimator {
        const estimator = new TokenEstimator(state.accumulatedUsage);
        if (state.quotaHistory) {
            for (const [key, value] of state.quotaHistory) {
                estimator.quotaHistory.set(key, {
                    ...value,
                    category: value.category as ModelCategory,  // Cast to ModelCategory
                });
            }
        }
        return estimator;
    }

    /**
     * Reset daily/weekly counters (keep monthly)
     */
    resetDaily(): void {
        // For now, just update timestamp
        // In a more complete implementation, we'd track daily/weekly/monthly separately
        this.accumulatedUsage.lastUpdated = new Date();
    }
}
