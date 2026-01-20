/**
 * Usage data collector for agy-top
 * Collects token usage from Antigravity logs
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { UsageStats, ModelUsage, DailyUsage, WeeklyTrend } from '../types/index.js';

// Known Antigravity log locations
const ANTIGRAVITY_PATHS = [
    join(homedir(), '.antigravity'),
    join(homedir(), '.vscode', 'extensions'),
    join(homedir(), '.cursor', 'extensions'),
];

// Model cost estimates (per 1M tokens)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
    'gemini-2.5-pro': { input: 1.25, output: 5.00 },
    'gemini-2.5-flash': { input: 0.075, output: 0.30 },
    'gemini-3-flash': { input: 0.10, output: 0.40 },
    'gemini-exp-1206': { input: 0.0, output: 0.0 }, // Free tier
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },
    'default': { input: 0.50, output: 2.00 },
};

interface ConversationLog {
    timestamp: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
}

export class UsageCollector {
    private basePath: string;
    private cache: Map<string, UsageStats> = new Map();

    constructor(basePath?: string) {
        this.basePath = basePath || this.findAntigravityPath();
    }

    /**
     * Find the Antigravity installation path
     */
    private findAntigravityPath(): string {
        // Default to home directory .antigravity
        return join(homedir(), '.antigravity');
    }

    /**
     * Collect current usage statistics
     */
    async collect(): Promise<UsageStats> {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        try {
            const logs = await this.readLogs(startOfDay, now);
            return this.aggregateLogs(logs, startOfDay, now);
        } catch (error) {
            // Return empty stats if logs can't be read
            return this.getEmptyStats(startOfDay, now);
        }
    }

    /**
     * Collect weekly usage data
     */
    async collectWeekly(): Promise<DailyUsage[]> {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const dailyUsage: DailyUsage[] = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

            try {
                const logs = await this.readLogs(startOfDay, endOfDay);
                const stats = this.aggregateLogs(logs, startOfDay, endOfDay);
                dailyUsage.push({
                    date: startOfDay.toISOString().split('T')[0],
                    tokens: stats.totalTokens,
                });
            } catch {
                dailyUsage.push({
                    date: startOfDay.toISOString().split('T')[0],
                    tokens: 0,
                });
            }
        }

        return dailyUsage;
    }

    /**
     * Get weekly trend percentages
     */
    async getWeeklyTrend(): Promise<WeeklyTrend[]> {
        const dailyUsage = await this.collectWeekly();
        const maxTokens = Math.max(...dailyUsage.map(d => d.tokens), 1);
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        return dailyUsage.map((usage, index) => ({
            day: days[(new Date(usage.date).getDay() + 6) % 7], // Convert to Mon-Sun
            percentage: (usage.tokens / maxTokens) * 100,
        }));
    }

    /**
     * Read logs from filesystem
     */
    private async readLogs(start: Date, end: Date): Promise<ConversationLog[]> {
        const logs: ConversationLog[] = [];
        const logsPath = join(this.basePath, 'logs');

        try {
            const files = await readdir(logsPath);

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                const filePath = join(logsPath, file);
                const fileStat = await stat(filePath);

                // Check if file is within time range
                if (fileStat.mtime < start || fileStat.mtime > end) continue;

                try {
                    const content = await readFile(filePath, 'utf-8');
                    const log = JSON.parse(content) as ConversationLog;
                    logs.push(log);
                } catch {
                    // Skip invalid files
                }
            }
        } catch {
            // Logs directory doesn't exist or can't be read
        }

        return logs;
    }

    /**
     * Aggregate logs into usage statistics
     */
    private aggregateLogs(logs: ConversationLog[], start: Date, end: Date): UsageStats {
        const modelMap = new Map<string, ModelUsage>();
        let totalInput = 0;
        let totalOutput = 0;
        let sessionCount = 0;

        for (const log of logs) {
            const model = log.model || 'unknown';
            const input = log.inputTokens || 0;
            const output = log.outputTokens || 0;

            totalInput += input;
            totalOutput += output;
            sessionCount++;

            const existing = modelMap.get(model) || {
                model,
                inputTokens: 0,
                outputTokens: 0,
                sessions: 0,
                estimatedCost: 0,
            };

            existing.inputTokens += input;
            existing.outputTokens += output;
            existing.sessions++;

            // Calculate cost
            const costs = MODEL_COSTS[model] || MODEL_COSTS['default'];
            existing.estimatedCost =
                (existing.inputTokens / 1_000_000) * costs.input +
                (existing.outputTokens / 1_000_000) * costs.output;

            modelMap.set(model, existing);
        }

        return {
            inputTokens: totalInput,
            outputTokens: totalOutput,
            totalTokens: totalInput + totalOutput,
            sessionCount,
            modelBreakdown: Array.from(modelMap.values()).sort(
                (a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens)
            ),
            periodStart: start,
            periodEnd: end,
        };
    }

    /**
     * Get empty stats
     */
    private getEmptyStats(start: Date, end: Date): UsageStats {
        return {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            sessionCount: 0,
            modelBreakdown: [],
            periodStart: start,
            periodEnd: end,
        };
    }

    /**
     * Generate mock data for development/demo
     */
    static getMockStats(): UsageStats {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return {
            inputTokens: 1_834_567,
            outputTokens: 847_890,
            totalTokens: 2_682_457,
            sessionCount: 47,
            modelBreakdown: [
                { model: 'gemini-2.5-pro', inputTokens: 1_234_567, outputTokens: 567_890, sessions: 25, estimatedCost: 4.38 },
                { model: 'gemini-2.5-flash', inputTokens: 456_789, outputTokens: 234_567, sessions: 15, estimatedCost: 0.10 },
                { model: 'gemini-3-flash', inputTokens: 143_211, outputTokens: 45_433, sessions: 7, estimatedCost: 0.03 },
            ],
            periodStart: startOfDay,
            periodEnd: now,
        };
    }

    /**
     * Generate mock weekly trend
     */
    static getMockWeeklyTrend(): WeeklyTrend[] {
        return [
            { day: 'Mon', percentage: 85 },
            { day: 'Tue', percentage: 45 },
            { day: 'Wed', percentage: 70 },
            { day: 'Thu', percentage: 30 },
            { day: 'Fri', percentage: 60 },
            { day: 'Sat', percentage: 20 },
            { day: 'Sun', percentage: 100 },
        ];
    }
}
