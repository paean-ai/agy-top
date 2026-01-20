/**
 * Dashboard runner for agy-top
 * Full-screen ASCII dashboard with real-time updates from Antigravity Language Server
 */

import logUpdate from 'log-update';
import chalk from 'chalk';
import { detectAntigravityServer, type ServerInfo } from '../data/server-detector.js';
import { fetchQuota, type QuotaSnapshot } from '../data/quota-service.js';
import { isAuthenticated, getLastSubmission, storeLastSubmission } from '../utils/config.js';
import { formatTokens, progressBar, miniBar } from '../utils/output.js';
import { generateCumulativeChecksum } from '../utils/crypto.js';
import { ApiClient } from '../api/client.js';
import { t, initLocale, getLocale, setLocale, type SupportedLocale } from '../utils/i18n.js';
import type { DashboardOptions, WeeklyTrend, LeaderboardData } from '../types/index.js';

const VERSION = '0.2.1';

type ViewMode = 'dashboard' | 'leaderboard' | 'submit' | 'help';

type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';

interface TokenUsageStats {
    daily: number;
    weekly: number;
    monthly: number;
}

interface DashboardState {
    server: ServerInfo | null;
    snapshot: QuotaSnapshot | null;
    previousSnapshot: QuotaSnapshot | null;
    weeklyTrend: WeeklyTrend[];
    uptime: number;
    lastRefresh: Date;
    lastSubmitTime: Date | null;
    isLoading: boolean;
    error: string | null;
    currentView: ViewMode;
    leaderboardData: LeaderboardData | null;
    submitMessage: string | null;
    autoSubmitEnabled: boolean;
    leaderboardPeriod: LeaderboardPeriod;
    tokenUsageStats: TokenUsageStats | null;
}

/**
 * Run the dashboard in full-screen mode
 */
export async function runDashboard(options: DashboardOptions): Promise<void> {
    const startTime = Date.now();

    // Initialize i18n
    initLocale();

    // Clear screen and hide cursor for full-screen mode
    process.stdout.write('\x1B[?25l'); // Hide cursor
    console.clear();

    let state: DashboardState = {
        server: null,
        snapshot: null,
        previousSnapshot: null,
        weeklyTrend: generateMockWeeklyTrend(),
        uptime: 0,
        lastRefresh: new Date(),
        lastSubmitTime: null,
        isLoading: true,
        error: null,
        currentView: 'dashboard',
        leaderboardData: null,
        submitMessage: null,
        autoSubmitEnabled: true,  // Enable auto-submit by default
        leaderboardPeriod: 'weekly',
        tokenUsageStats: null,
    };

    // Initial server detection
    console.log(chalk.dim(t('detectingServer')));

    const detection = await detectAntigravityServer();
    if (!detection.success || !detection.server) {
        process.stdout.write('\x1B[?25h'); // Show cursor
        console.log(chalk.red('✗ ' + (detection.error || t('serverNotFound'))));
        if (detection.tip) {
            console.log(chalk.yellow('  Tip: ' + detection.tip));
        }
        console.log(chalk.dim('\n' + t('tipIdeRunning')));
        process.exit(1);
    }

    state.server = detection.server;
    console.log(chalk.green(`${t('serverFound')} ${detection.server.port}`));
    console.log(chalk.dim(`  ${t('startingDashboard')}\n`));

    // Initial data load
    await refreshData(state, options);
    state.isLoading = false;

    // Handle terminal resize
    process.stdout.on('resize', () => {
        render(state, options);
    });

    // Handle exit - restore cursor
    const cleanup = () => {
        logUpdate.clear();
        process.stdout.write('\x1B[?25h'); // Show cursor
        console.clear();
        console.log(chalk.dim('Goodbye! 👋'));
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Setup keyboard input
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        // State to track current view
        let currentView: 'dashboard' | 'leaderboard' | 'submit' | 'help' = 'dashboard';

        // Helper to clear screen properly
        const clearScreen = () => {
            logUpdate.clear();
            logUpdate.done();
            process.stdout.write('\x1B[2J\x1B[0;0H'); // Clear screen and move cursor to top
        };

        process.stdin.on('data', async (key: string) => {
            // Handle leaderboard view key handlers (period switching)
            if (state.currentView === 'leaderboard') {
                const periods: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'yearly', 'all_time'];
                const currentIdx = periods.indexOf(state.leaderboardPeriod);

                // Number keys 1-5 for direct period selection
                if (key >= '1' && key <= '5') {
                    const newPeriod = periods[parseInt(key) - 1];
                    if (newPeriod !== state.leaderboardPeriod) {
                        state.leaderboardPeriod = newPeriod;
                        state.isLoading = true;
                        render(state, options);
                        try {
                            state.leaderboardData = await ApiClient.getLeaderboard({ period: state.leaderboardPeriod, limit: 20 });
                        } catch (error) {
                            state.error = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
                        }
                        state.isLoading = false;
                        render(state, options);
                    }
                    return;
                }

                // Left/Right arrow keys for cycling periods
                if (key === '\x1B[D' || key === 'h') { // Left arrow or h
                    if (currentIdx > 0) {
                        state.leaderboardPeriod = periods[currentIdx - 1];
                        state.isLoading = true;
                        render(state, options);
                        try {
                            state.leaderboardData = await ApiClient.getLeaderboard({ period: state.leaderboardPeriod, limit: 20 });
                        } catch (error) {
                            state.error = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
                        }
                        state.isLoading = false;
                        render(state, options);
                    }
                    return;
                }
                if (key === '\x1B[C' || key === 'l') { // Right arrow or l (vim style)
                    if (currentIdx < periods.length - 1) {
                        state.leaderboardPeriod = periods[currentIdx + 1];
                        state.isLoading = true;
                        render(state, options);
                        try {
                            state.leaderboardData = await ApiClient.getLeaderboard({ period: state.leaderboardPeriod, limit: 20 });
                        } catch (error) {
                            state.error = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
                        }
                        state.isLoading = false;
                        render(state, options);
                    }
                    return;
                }

                // q or Escape to return to dashboard
                if (key === 'q' || key === '\x1B' || key === '\u0003') {
                    state.currentView = 'dashboard';
                    state.leaderboardData = null;
                    render(state, options);
                    return;
                }
                return; // Ignore other keys in leaderboard view
            }

            // Handle other non-dashboard views (help, submit)
            if (state.currentView !== 'dashboard') {
                // Any key returns to dashboard from other views
                state.currentView = 'dashboard';
                state.leaderboardData = null;
                state.submitMessage = null;
                render(state, options);
                return;
            }

            // Dashboard view key handlers
            if (key === 'q' || key === '\u0003') { // q or Ctrl+C
                cleanup();
            }
            if (key === 'r') {
                state.isLoading = true;
                render(state, options);
                await refreshData(state, options);
                state.isLoading = false;
                render(state, options);
            }
            if (key === 'l' && options.rankMode) {
                state.currentView = 'leaderboard';
                state.isLoading = true;
                render(state, options);
                try {
                    state.leaderboardData = await ApiClient.getLeaderboard({ period: state.leaderboardPeriod, limit: 20 });
                } catch (error) {
                    state.error = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
                }
                state.isLoading = false;
                render(state, options);
            }
            if (key === 's' && options.rankMode) {
                state.currentView = 'submit';
                state.submitMessage = 'Submitting usage data...';
                render(state, options);
                await performSubmit(state);
                render(state, options);
            }
            if (key === '?') {
                state.currentView = 'help';
                render(state, options);
            }
        });
    }

    // Auto-refresh loop
    const refreshLoop = async () => {
        state.uptime = Math.floor((Date.now() - startTime) / 1000);

        // Only render if in dashboard view
        if (state.currentView === 'dashboard') {
            render(state, options);
        }

        if (options.autoRefresh) {
            setTimeout(async () => {
                await refreshData(state, options);
                refreshLoop();
            }, options.refreshInterval);
        }
    };

    refreshLoop();
}

/**
 * Refresh data from Language Server and auto-submit if usage changed
 */
async function refreshData(state: DashboardState, options: DashboardOptions): Promise<void> {
    if (!state.server) return;

    try {
        const result = await fetchQuota(state.server);
        if (result.success && result.snapshot) {
            // Store previous snapshot for comparison
            state.previousSnapshot = state.snapshot;
            state.snapshot = result.snapshot;
            state.error = null;

            // Auto-submit if usage changed and authenticated
            if (state.autoSubmitEnabled && options.rankMode && isAuthenticated()) {
                await checkAndAutoSubmit(state);
            }
        } else {
            state.error = result.error || 'Failed to fetch quota';
        }
        state.lastRefresh = new Date();

        // Fetch token usage statistics (daily/weekly/monthly)
        // Try to fetch from API if authenticated, otherwise estimate from snapshot
        try {
            if (isAuthenticated()) {
                await fetchTokenUsageStats(state);
                await fetchWeeklyTrend(state);
            } else if (state.snapshot?.tokenUsage) {
                // Estimate from snapshot for unauthenticated users
                await fetchTokenUsageStats(state);
            }
        } catch (error) {
            // Silently fail - token stats are optional
        }
    } catch (error) {
        state.error = error instanceof Error ? error.message : 'Refresh failed';
    }
}

/**
 * Fetch token usage statistics for daily/weekly/monthly periods
 */
async function fetchTokenUsageStats(state: DashboardState): Promise<void> {
    try {
        // Fetch daily usage
        const dailyResult = await ApiClient.getMyUsage({ period: 'daily', limit: 1 });
        let dailyTokens = 0;
        if (dailyResult.records.length > 0) {
            const record = dailyResult.records[0];
            // API returns strings, so we need to convert to numbers
            // Prefer totalTokens if available, otherwise sum inputTokens and outputTokens
            if (record.totalTokens !== undefined && record.totalTokens !== null) {
                dailyTokens = Number(record.totalTokens) || 0;
            } else {
                // Fallback to sum of inputTokens and outputTokens (convert strings to numbers)
                const input = Number(record.inputTokens || 0) || 0;
                const output = Number(record.outputTokens || 0) || 0;
                dailyTokens = input + output;
            }
        }

        // Fetch weekly usage
        const weeklyResult = await ApiClient.getMyUsage({ period: 'weekly', limit: 1 });
        let weeklyTokens = 0;
        if (weeklyResult.records.length > 0) {
            const record = weeklyResult.records[0];
            if (record.totalTokens !== undefined && record.totalTokens !== null) {
                weeklyTokens = Number(record.totalTokens) || 0;
            } else {
                const input = Number(record.inputTokens || 0) || 0;
                const output = Number(record.outputTokens || 0) || 0;
                weeklyTokens = input + output;
            }
        }

        // Fetch monthly usage
        const monthlyResult = await ApiClient.getMyUsage({ period: 'monthly', limit: 1 });
        let monthlyTokens = 0;
        if (monthlyResult.records.length > 0) {
            const record = monthlyResult.records[0];
            if (record.totalTokens !== undefined && record.totalTokens !== null) {
                monthlyTokens = Number(record.totalTokens) || 0;
            } else {
                const input = Number(record.inputTokens || 0) || 0;
                const output = Number(record.outputTokens || 0) || 0;
                monthlyTokens = input + output;
            }
        }

        // Validate token values - if they seem unreasonably large (> 1 billion), 
        // they might be credits instead of tokens, or there's a data issue
        // Typical usage: millions to tens of millions of tokens per month
        const MAX_REASONABLE_TOKENS = 1_000_000_000; // 1 billion tokens
        
        if (dailyTokens > MAX_REASONABLE_TOKENS || 
            weeklyTokens > MAX_REASONABLE_TOKENS || 
            monthlyTokens > MAX_REASONABLE_TOKENS) {
            // Data seems invalid, fall back to snapshot-based calculation
            throw new Error('Token values exceed reasonable limits, using snapshot data instead');
        }

        // If all three values are identical and very large, likely a data issue
        if (dailyTokens === weeklyTokens && weeklyTokens === monthlyTokens && dailyTokens > 10_000_000) {
            throw new Error('All periods show identical values, likely data issue, using snapshot data instead');
        }

        state.tokenUsageStats = {
            daily: dailyTokens,
            weekly: weeklyTokens,
            monthly: monthlyTokens,
        };
    } catch (error) {
        // If API fails or data is invalid, try to calculate from snapshot if available
        if (state.snapshot?.tokenUsage) {
            const tu = state.snapshot.tokenUsage;
            const promptUsed = (tu.promptCredits?.monthly || 0) - (tu.promptCredits?.available || 0);
            const flowUsed = (tu.flowCredits?.monthly || 0) - (tu.flowCredits?.available || 0);
            const totalUsed = promptUsed + flowUsed;

            // Estimate daily/weekly from monthly (rough approximation)
            const now = new Date();
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const dayOfMonth = now.getDate();
            const dayOfWeek = now.getDay() || 7; // 1-7 (Mon-Sun)

            state.tokenUsageStats = {
                daily: Math.floor((totalUsed / dayOfMonth) * 1.2), // Slight overestimate for today
                weekly: Math.floor((totalUsed / daysInMonth) * dayOfWeek),
                monthly: totalUsed,
            };
        } else {
            // No snapshot data available, set to null to hide the section
            state.tokenUsageStats = null;
        }
    }
}

/**
 * Fetch weekly trend data from API
 */
async function fetchWeeklyTrend(state: DashboardState): Promise<void> {
    try {
        // Fetch weekly usage records (last 7 days)
        const weeklyResult = await ApiClient.getMyUsage({ period: 'weekly', limit: 30 });
        
        if (weeklyResult.records && weeklyResult.records.length > 0) {
            // Group records by day
            const dailyUsageMap = new Map<string, number>();
            const now = new Date();
            
            // Initialize all 7 days with 0
            for (let i = 6; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                date.setHours(0, 0, 0, 0);
                const dateStr = date.toISOString().split('T')[0];
                dailyUsageMap.set(dateStr, 0);
            }
            
            // Fill in actual usage data from records
            for (const record of weeklyResult.records as any[]) {
                if (record.periodStart) {
                    const recordDate = new Date(record.periodStart);
                    recordDate.setHours(0, 0, 0, 0);
                    const dateStr = recordDate.toISOString().split('T')[0];
                    // Convert strings to numbers to avoid string concatenation
                    let tokens = 0;
                    if (record.totalTokens !== undefined && record.totalTokens !== null) {
                        tokens = Number(record.totalTokens) || 0;
                    } else {
                        const input = Number(record.inputTokens || 0) || 0;
                        const output = Number(record.outputTokens || 0) || 0;
                        tokens = input + output;
                    }
                    const existing = dailyUsageMap.get(dateStr) || 0;
                    dailyUsageMap.set(dateStr, existing + tokens);
                }
            }
            
            // Convert to WeeklyTrend format
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const trendData: WeeklyTrend[] = [];
            const usageValues = Array.from(dailyUsageMap.values());
            const maxTokens = Math.max(...usageValues, 1);
            
            for (let i = 6; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                date.setHours(0, 0, 0, 0);
                const dateStr = date.toISOString().split('T')[0];
                const tokens = dailyUsageMap.get(dateStr) || 0;
                const dayOfWeek = (date.getDay() + 6) % 7; // Convert to Mon-Sun (0-6)
                
                trendData.push({
                    day: days[dayOfWeek],
                    date: dateStr,
                    inputTokens: 0, // Not available from aggregated API
                    outputTokens: 0, // Not available from aggregated API
                    percentage: maxTokens > 0 ? (tokens / maxTokens) * 100 : 0,
                });
            }
            
            state.weeklyTrend = trendData;
        }
    } catch (error) {
        // Keep existing trend data if fetch fails
    }
}

/**
 * Check if usage changed and auto-submit
 */
async function checkAndAutoSubmit(state: DashboardState): Promise<void> {
    if (!state.snapshot || !state.previousSnapshot) return;

    // Compare token usage
    const prevPrompt = state.previousSnapshot.tokenUsage?.promptCredits?.available || 0;
    const currPrompt = state.snapshot.tokenUsage?.promptCredits?.available || 0;
    const prevFlow = state.previousSnapshot.tokenUsage?.flowCredits?.available || 0;
    const currFlow = state.snapshot.tokenUsage?.flowCredits?.available || 0;

    // Check if credits decreased (meaning tokens were used)
    const usageChanged = currPrompt < prevPrompt || currFlow < prevFlow;

    // Rate limit: don't submit more than once per 5 minutes
    const minInterval = 5 * 60 * 1000;
    const timeSinceLastSubmit = state.lastSubmitTime
        ? Date.now() - state.lastSubmitTime.getTime()
        : Infinity;

    if (usageChanged && timeSinceLastSubmit >= minInterval) {
        try {
            await doSubmit(state);
        } catch {
            // Silently fail auto-submit
        }
    }
}

/**
 * Perform manual submit with complete model data
 */
async function performSubmit(state: DashboardState): Promise<void> {
    if (!isAuthenticated()) {
        state.submitMessage = '⚠ Please login first: agy-top login';
        return;
    }

    if (!state.snapshot) {
        state.submitMessage = '⚠ No usage data available';
        return;
    }

    try {
        const result = await doSubmit(state);

        if (result.success) {
            state.submitMessage = `✓ Submitted! Rank: #${result.rank || 'N/A'} | Trust: ${result.trustScore}/100`;
        } else {
            state.submitMessage = `⚠ ${result.message || 'Submission failed'}`;
        }
    } catch (error) {
        state.submitMessage = `✗ Error: ${error instanceof Error ? error.message : 'Submit failed'}`;
    }
}

/**
 * Shared submission logic
 */
async function doSubmit(state: DashboardState): Promise<{ success: boolean; rank?: number; trustScore?: number; message?: string }> {
    const snapshot = state.snapshot!;

    // Calculate current usage from BOTH credits AND model quotas
    // Credits: promptCredits and flowCredits
    const promptMonthly = snapshot.tokenUsage?.promptCredits?.monthly || 0;
    const flowMonthly = snapshot.tokenUsage?.flowCredits?.monthly || 0;
    const promptAvailable = snapshot.tokenUsage?.promptCredits?.available || 0;
    const flowAvailable = snapshot.tokenUsage?.flowCredits?.available || 0;

    const creditsUsedPrompt = promptMonthly - promptAvailable;
    const creditsUsedFlow = flowMonthly - flowAvailable;

    // Model quotas: sum of (100 - remainingPercentage) across all models
    // This represents actual model usage even if credits don't reflect it
    const modelUsageTotal = snapshot.models.reduce((sum, m) => sum + (100 - m.remainingPercentage), 0);

    // Estimate tokens from model usage (each model can use ~50K tokens when at 0%)
    // This is a rough estimate: 50K tokens per model * usage percentage
    const estimatedTokensPerModel = 50000; // Conservative estimate
    const modelBasedTokens = snapshot.models.reduce((sum, m) => {
        const usedPercent = (100 - m.remainingPercentage) / 100;
        return sum + Math.floor(estimatedTokensPerModel * usedPercent);
    }, 0);

    // Use the larger of credits-based or model-based usage
    const currentUsedPrompt = Math.max(creditsUsedPrompt, Math.floor(modelBasedTokens * 0.6));
    const currentUsedFlow = Math.max(creditsUsedFlow, Math.floor(modelBasedTokens * 0.4));

    // Get last submission usage to calculate incremental diff
    const lastSubmission = getLastSubmission();
    const lastUsedPrompt = lastSubmission?.totalUsedInput || 0;
    const lastUsedFlow = lastSubmission?.totalUsedOutput || 0;

    // Calculate increment (handle monthly resets where current < last)
    let incrementalInput = currentUsedPrompt - lastUsedPrompt;
    let incrementalOutput = currentUsedFlow - lastUsedFlow;

    // If quota reset happened (current < last), we assume the entire current usage is new
    if (incrementalInput < 0) incrementalInput = currentUsedPrompt;
    if (incrementalOutput < 0) incrementalOutput = currentUsedFlow;

    // Also check for model quota changes (even if credits haven't changed)
    const lastModelUsage = lastSubmission ? (lastUsedPrompt + lastUsedFlow) : 0;
    const currentModelUsage = currentUsedPrompt + currentUsedFlow;
    const hasModelChange = currentModelUsage > lastModelUsage;

    if (incrementalInput <= 0 && incrementalOutput <= 0 && !hasModelChange) {
        return { success: false, message: 'No new usage to submit' };
    }

    // Ensure we have at least something to submit
    if (incrementalInput <= 0 && incrementalOutput <= 0 && hasModelChange) {
        // Force minimum submission based on model change
        incrementalInput = Math.max(1, currentUsedPrompt - lastUsedPrompt);
        incrementalOutput = Math.max(1, currentUsedFlow - lastUsedFlow);
    }

    // Build model breakdown for this increment
    // Note: We can't perfectly attribute the *increment* to specific models without tracking per-model usage history.
    // We approximate by distributing the incremental tokens based on current model usage weighting.
    const modelBreakdown: Record<string, { inputTokens: number; outputTokens: number; sessions: number }> = {};
    const activeModels = snapshot.models.filter(m => m.remainingPercentage < 100);
    const totalIncremental = incrementalInput + incrementalOutput;

    // Calculate total weighted usage for distribution
    let totalWeight = 0;
    const modelWeights: { id: string; weight: number }[] = [];

    for (const model of activeModels) {
        const usedPercentage = 100 - model.remainingPercentage;
        totalWeight += usedPercentage;
        modelWeights.push({ id: model.modelId, weight: usedPercentage });
    }

    if (totalWeight > 0) {
        for (const mw of modelWeights) {
            const share = mw.weight / totalWeight;
            const modelTokens = totalIncremental * share;
            modelBreakdown[mw.id] = {
                inputTokens: Math.floor(modelTokens * 0.6),
                outputTokens: Math.floor(modelTokens * 0.4),
                sessions: 1, // Active in this period
            };
        }
    }

    const sessionCount = activeModels.length || 1;

    // Period: One week window ending now
    // NOTE: This overlaps, but since we submit INCREMENTAL tokens, the backend addition logic is correct.
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const periodStart = weekStart.toISOString();
    const periodEnd = now.toISOString();

    const previousChecksum = lastSubmission?.checksum || '0'.repeat(64);
    const cumulativeChecksum = generateCumulativeChecksum(
        { periodStart, periodEnd, inputTokens: incrementalInput, outputTokens: incrementalOutput, sessionCount },
        previousChecksum
    );

    const result = await ApiClient.submitUsage({
        periodStart,
        periodEnd,
        inputTokens: incrementalInput,
        outputTokens: incrementalOutput,
        sessionCount,
        modelBreakdown,
        cumulativeChecksum,
        previousChecksum,
        clientVersion: VERSION,
    });

    if (result.success) {
        state.lastSubmitTime = new Date();
        storeLastSubmission({
            timestamp: new Date().toISOString(),
            checksum: cumulativeChecksum,
            totalUsedInput: currentUsedPrompt,
            totalUsedOutput: currentUsedFlow
        });
    }

    return result;
}

/**
 * Render the full-screen dashboard
 */
function render(state: DashboardState, options: DashboardOptions): void {
    // Route to appropriate view renderer
    switch (state.currentView) {
        case 'leaderboard':
            renderLeaderboard(state, options);
            break;
        case 'help':
            renderHelp(state, options);
            break;
        case 'submit':
            renderSubmit(state, options);
            break;
        default:
            renderDashboard(state, options);
    }
}

/**
 * Render main dashboard view
 */
function renderDashboard(state: DashboardState, options: DashboardOptions): void {
    const { snapshot, weeklyTrend, uptime, lastRefresh, isLoading, error, tokenUsageStats } = state;

    // Use full terminal width/height
    const termWidth = process.stdout.columns || 80;
    const termHeight = process.stdout.rows || 24;
    const width = Math.min(termWidth, 100);

    const lines: string[] = [];

    // Add top padding for centering
    const contentHeight = estimateContentHeight(snapshot, tokenUsageStats);
    const topPadding = Math.max(0, Math.floor((termHeight - contentHeight) / 2) - 1);
    for (let i = 0; i < topPadding; i++) {
        lines.push('');
    }

    // Calculate horizontal padding for centering
    const leftPad = Math.max(0, Math.floor((termWidth - width) / 2));
    const pad = ' '.repeat(leftPad);

    // Header with double line
    lines.push(pad + chalk.cyan('╔' + '═'.repeat(width - 2) + '╗'));
    lines.push(pad + chalk.cyan('║') + centerText(chalk.bold(`agy-top v${VERSION}`), width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('║') + centerText(chalk.dim('Antigravity Usage Statistics'), width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╠' + '═'.repeat(width - 2) + '╣'));

    // Status bar with proper spacing
    const uptimeStr = formatUptime(uptime);
    const modelCount = snapshot?.models.length || 0;
    const refreshStr = isLoading ? chalk.yellow('⟳ Refreshing...') : `Last: ${formatTimeAgo(lastRefresh)}`;
    const authDot = isAuthenticated() ? chalk.green('●') : chalk.dim('○');

    const statusLeft = `  ${chalk.dim('Uptime:')} ${chalk.white(uptimeStr)}  ${chalk.dim('│')}  ${chalk.dim('Models:')} ${chalk.white(modelCount)}`;
    const statusRight = `${refreshStr}  ${authDot}  `;
    const statusGap = width - stripAnsi(statusLeft).length - stripAnsi(statusRight).length - 2;

    lines.push(pad + chalk.cyan('║') + statusLeft + ' '.repeat(Math.max(1, statusGap)) + statusRight + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╠' + '═'.repeat(width - 2) + '╣'));

    // Error display
    if (error) {
        lines.push(pad + chalk.cyan('║') + padEndAnsi(chalk.red(`  ⚠  ${error}`), width - 2) + chalk.cyan('║'));
        lines.push(pad + chalk.cyan('╟' + '─'.repeat(width - 2) + '╢'));
    }

    // User info with better formatting
    if (snapshot?.userInfo) {
        const userName = snapshot.userInfo.name || 'User';
        const userTier = snapshot.userInfo.tier || 'Free';
        // Only show tier (e.g., "Google AI Ultra"), planName is redundant
        const userLine = `  ${chalk.bold.white(userName)}  ${chalk.dim('│')}  ${chalk.yellow(userTier)}`;
        lines.push(pad + chalk.cyan('║') + padEndAnsi(userLine, width - 2) + chalk.cyan('║'));
        lines.push(pad + chalk.cyan('╟' + '─'.repeat(width - 2) + '╢'));
    }

    // Token usage statistics (daily/weekly/monthly)
    if (tokenUsageStats) {
        lines.push(pad + chalk.cyan('║') + padEndAnsi(chalk.dim('  TOKEN USAGE'), width - 2) + chalk.cyan('║'));
        lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));

        // Calculate spacing for three columns with separators
        // Separator is ' │ ' which is 3 characters (space + pipe + space)
        const separator = chalk.dim(' │ ');
        const separatorWidth = 3; // Actual width of separator
        const leftPadding = 2; // Left padding inside box
        const availableWidth = width - 2 - leftPadding; // Total available width inside box
        const colWidth = Math.floor((availableWidth - separatorWidth * 2) / 3); // Three columns, two separators

        const dailyLabel = chalk.dim('Today:');
        const weeklyLabel = chalk.dim('This Week:');
        const monthlyLabel = chalk.dim('This Month:');

        // Format values, ensuring they're reasonable numbers
        const dailyValue = chalk.bold.cyan(formatTokens(tokenUsageStats.daily));
        const weeklyValue = chalk.bold.yellow(formatTokens(tokenUsageStats.weekly));
        const monthlyValue = chalk.bold.magenta(formatTokens(tokenUsageStats.monthly));

        // First row: labels - pad to column width
        const dailyLabelPadded = padEndAnsi(dailyLabel, colWidth);
        const weeklyLabelPadded = padEndAnsi(weeklyLabel, colWidth);
        const monthlyLabelPadded = padEndAnsi(monthlyLabel, colWidth);
        const labelRow = ' '.repeat(leftPadding) + dailyLabelPadded + separator + weeklyLabelPadded + separator + monthlyLabelPadded;
        lines.push(pad + chalk.cyan('║') + padEndAnsi(labelRow, width - 2) + chalk.cyan('║'));

        // Second row: values - pad to column width
        const dailyValuePadded = padEndAnsi(dailyValue, colWidth);
        const weeklyValuePadded = padEndAnsi(weeklyValue, colWidth);
        const monthlyValuePadded = padEndAnsi(monthlyValue, colWidth);
        const valueRow = ' '.repeat(leftPadding) + dailyValuePadded + separator + weeklyValuePadded + separator + monthlyValuePadded;
        lines.push(pad + chalk.cyan('║') + padEndAnsi(valueRow, width - 2) + chalk.cyan('║'));

        lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
        lines.push(pad + chalk.cyan('╟' + '─'.repeat(width - 2) + '╢'));
    }

    // Credits overview with aligned bars
    if (snapshot?.tokenUsage) {
        lines.push(pad + chalk.cyan('║') + padEndAnsi(chalk.dim('  CREDITS OVERVIEW'), width - 2) + chalk.cyan('║'));
        lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));

        const tu = snapshot.tokenUsage;
        const barWidth = Math.min(35, width - 50);

        // Prompt Credits
        if (tu.promptCredits) {
            const pc = tu.promptCredits;
            const pcBar = progressBar(pc.remainingPercentage, barWidth);
            const pctStr = `${pc.remainingPercentage.toFixed(0)}%`.padStart(4);
            const tokenStr = `(${formatTokens(pc.available)}/${formatTokens(pc.monthly)})`;
            const pStr = `  ${'Prompt:'.padEnd(10)} ${pcBar}  ${pctStr}  ${tokenStr}`;
            lines.push(pad + chalk.cyan('║') + pStr.padEnd(width - 2) + chalk.cyan('║'));
        }

        // Flow Credits
        if (tu.flowCredits) {
            const fc = tu.flowCredits;
            const fcBar = progressBar(fc.remainingPercentage, barWidth);
            const pctStr = `${fc.remainingPercentage.toFixed(0)}%`.padStart(4);
            const tokenStr = `(${formatTokens(fc.available)}/${formatTokens(fc.monthly)})`;
            const fStr = `  ${'Flow:'.padEnd(10)} ${fcBar}  ${pctStr}  ${tokenStr}`;
            lines.push(pad + chalk.cyan('║') + fStr.padEnd(width - 2) + chalk.cyan('║'));
        }

        lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
        lines.push(pad + chalk.cyan('╟' + '─'.repeat(width - 2) + '╢'));
    }

    // Model quotas with table formatting
    lines.push(pad + chalk.cyan('║') + padEndAnsi(chalk.dim('  MODEL QUOTAS'), width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));

    const models = snapshot?.models || [];
    if (models.length === 0) {
        lines.push(pad + chalk.cyan('║') + padEndAnsi(chalk.dim('  No model quota data available...'), width - 2) + chalk.cyan('║'));
    } else {
        // Table header
        const nameCol = 32;
        const barCol = 10;
        const pctCol = 8;
        const resetCol = 12;
        const header = `  ${'MODEL'.padEnd(nameCol)}${''.padEnd(barCol)}${'REMAINING'.padStart(pctCol)}${'RESETS IN'.padStart(resetCol)}`;
        lines.push(pad + chalk.cyan('║') + padEndAnsi(chalk.dim(header), width - 2) + chalk.cyan('║'));

        // Model rows
        for (const model of models.slice(0, 7)) {
            let modelName = model.label;
            if (modelName.length > nameCol - 2) {
                modelName = modelName.slice(0, nameCol - 4) + '..';
            }

            const barStr = miniBar(model.remainingPercentage, 8);
            const pctStr = model.isExhausted
                ? chalk.red('NONE')
                : (model.remainingPercentage >= 80 ? chalk.green : model.remainingPercentage >= 40 ? chalk.yellow : chalk.red)(`${model.remainingPercentage.toFixed(0)}%`);
            const resetStr = model.timeUntilReset;

            // Build row with fixed column widths - use padEndAnsi for colored text
            const row = `  ${modelName.padEnd(nameCol)}${barStr}  ${padEndAnsi(pctStr, pctCol)}  ${resetStr.padStart(8)}`;
            lines.push(pad + chalk.cyan('║') + padEndAnsi(row, width - 2) + chalk.cyan('║'));
        }

        if (models.length > 7) {
            lines.push(pad + chalk.cyan('║') + padEndAnsi(chalk.dim(`  ... and ${models.length - 7} more models`), width - 2) + chalk.cyan('║'));
        }
    }

    lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╟' + '─'.repeat(width - 2) + '╢'));

    // Weekly trend with proper spacing
    lines.push(pad + chalk.cyan('║') + padEndAnsi(chalk.dim('  WEEKLY TREND (Past 7 Days Usage)'), width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));

    // Calculate spacing for weekly trend
    const trendItems = weeklyTrend.map(t => `${t.day}: ${miniBar(t.percentage, 6)}`);
    const totalTrendWidth = trendItems.reduce((sum, item) => sum + stripAnsi(item).length, 0) + (trendItems.length - 1) * 3;
    const trendPad = Math.max(2, Math.floor((width - 4 - totalTrendWidth) / 2));
    const trendLine = ' '.repeat(trendPad) + trendItems.join('   ');
    lines.push(pad + chalk.cyan('║') + trendLine.padEnd(width - 2) + chalk.cyan('║'));

    lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╚' + '═'.repeat(width - 2) + '╝'));

    // Footer with controls
    const controls = options.rankMode
        ? chalk.dim('  [q] Quit   [r] Refresh   [l] Leaderboard   [s] Submit   [?] Help')
        : chalk.dim('  [q] Quit   [r] Refresh   [?] Help');
    lines.push(pad + controls);

    // Auth status warning
    if (!isAuthenticated() && options.rankMode) {
        lines.push(pad + chalk.yellow('  ⚠ Not authenticated. Run "agy-top login" to submit to leaderboard.'));
    }

    logUpdate(lines.join('\n'));
}

/**
 * Strip ANSI codes for length calculation
 */
function stripAnsi(str: string): string {
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Get display width accounting for CJK characters (2 columns) and emojis
 */
function getDisplayWidth(str: string): number {
    const clean = stripAnsi(str);
    let width = 0;
    for (const char of clean) {
        const code = char.codePointAt(0) || 0;
        // CJK Unified Ideographs, CJK Symbols, Hiragana, Katakana, Fullwidth chars
        if (
            (code >= 0x4E00 && code <= 0x9FFF) ||  // CJK Unified Ideographs
            (code >= 0x3000 && code <= 0x303F) ||  // CJK Symbols and Punctuation
            (code >= 0x3040 && code <= 0x309F) ||  // Hiragana
            (code >= 0x30A0 && code <= 0x30FF) ||  // Katakana
            (code >= 0xFF00 && code <= 0xFFEF) ||  // Fullwidth Forms
            (code >= 0x1F300 && code <= 0x1F9FF) || // Emojis
            (code >= 0x2600 && code <= 0x26FF)     // Misc symbols
        ) {
            width += 2;
        } else {
            width += 1;
        }
    }
    return width;
}

/**
 * Pad string to width, accounting for ANSI codes and CJK characters
 */
function padEndAnsi(str: string, width: number): string {
    const visibleWidth = getDisplayWidth(str);
    if (visibleWidth >= width) return str;
    return str + ' '.repeat(width - visibleWidth);
}

/**
 * Estimate content height for centering
 */
function estimateContentHeight(snapshot: QuotaSnapshot | null, tokenUsageStats: TokenUsageStats | null): number {
    let height = 10; // Base (header, status, footer, etc.)
    if (snapshot?.userInfo) height += 2;
    if (tokenUsageStats) height += 5; // Token usage stats section
    if (snapshot?.tokenUsage) height += 6;
    height += Math.min(7, snapshot?.models.length || 0) + 4;
    height += 4; // Weekly trend
    return height;
}

/**
 * Show help overlay
 */
function showHelp(): void {
    console.log(`
${chalk.cyan('╭─ agy-top Help ─╮')}

${chalk.bold('Keyboard Shortcuts:')}
  ${chalk.cyan('q')}     Quit
  ${chalk.cyan('r')}     Refresh data
  ${chalk.cyan('l')}     Show leaderboard (rank mode)
  ${chalk.cyan('s')}     Submit usage data
  ${chalk.cyan('?')}     Show this help

${chalk.bold('Commands:')}
  ${chalk.cyan('agy-top')}           Show dashboard
  ${chalk.cyan('agy-top --rank')}    Enable leaderboard mode
  ${chalk.cyan('agy-top login')}     Authenticate
  ${chalk.cyan('agy-top logout')}    Sign out
  ${chalk.cyan('agy-top rank')}      View leaderboard
  ${chalk.cyan('agy-top submit')}    Submit usage data

Press any key to continue...
`);
}

/**
 * Center text within a width, accounting for CJK characters
 */
function centerText(text: string, width: number): string {
    const textWidth = getDisplayWidth(text);
    const padding = Math.max(0, Math.floor((width - textWidth) / 2));
    const rightPadding = Math.max(0, width - padding - textWidth);
    return ' '.repeat(padding) + text + ' '.repeat(rightPadding);
}

/**
 * Format uptime as human-readable
 */
function formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

/**
 * Format time ago
 */
function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
}

/**
 * Generate mock weekly trend (placeholder)
 */
function generateMockWeeklyTrend(): WeeklyTrend[] {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day, i) => ({
        day,
        date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        inputTokens: 0,
        outputTokens: 0,
        percentage: Math.random() * 100,
    }));
}

/**
 * Render leaderboard view with same styling as dashboard
 */
function renderLeaderboard(state: DashboardState, options: DashboardOptions): void {
    const termWidth = process.stdout.columns || 80;
    const width = Math.min(termWidth, 100);
    const leftPad = Math.max(0, Math.floor((termWidth - width) / 2));
    const pad = ' '.repeat(leftPad);

    const lines: string[] = [];

    // Period labels with selection indicator (using i18n)
    const periodLabels: { [key in LeaderboardPeriod]: string } = {
        daily: t('periodDailyShort'),
        weekly: t('periodWeeklyShort'),
        monthly: t('periodMonthlyShort'),
        yearly: t('periodYearlyShort'),
        all_time: t('periodAllTimeShort'),
    };
    const periodTabs = (['daily', 'weekly', 'monthly', 'yearly', 'all_time'] as LeaderboardPeriod[])
        .map(p => p === state.leaderboardPeriod
            ? chalk.cyan.bold(`[${periodLabels[p]}]`)
            : chalk.dim(` ${periodLabels[p]} `))
        .join(' ');

    // Header
    lines.push(pad + chalk.cyan('╔' + '═'.repeat(width - 2) + '╗'));
    lines.push(pad + chalk.cyan('║') + centerText(chalk.bold(t('leaderboard')), width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('║') + centerText(periodTabs, width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╠' + '═'.repeat(width - 2) + '╣'));

    if (state.isLoading) {
        lines.push(pad + chalk.cyan('║') + centerText(chalk.yellow(t('loadingLeaderboard')), width - 2) + chalk.cyan('║'));
    } else if (state.error) {
        lines.push(pad + chalk.cyan('║') + padEndAnsi(chalk.red(`  ⚠ ${state.error}`), width - 2) + chalk.cyan('║'));
    } else if (!state.leaderboardData || state.leaderboardData.entries.length === 0) {
        lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
        lines.push(pad + chalk.cyan('║') + centerText(chalk.dim(t('noEntriesYet')), width - 2) + chalk.cyan('║'));
        lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
    } else {
        // Table header
        const header = `  ${t('rank').padEnd(8)}${t('user').padEnd(25)}${t('tokens').padEnd(15)}${t('tier').padEnd(10)}`;
        lines.push(pad + chalk.cyan('║') + padEndAnsi(chalk.dim(header), width - 2) + chalk.cyan('║'));
        lines.push(pad + chalk.cyan('╟' + '─'.repeat(width - 2) + '╢'));

        // Entries
        for (const entry of state.leaderboardData.entries.slice(0, 15)) {
            const rankIcon = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '  ';
            const rankStr = `${rankIcon}${entry.rank}`.padEnd(8);
            const userStr = (entry.isCurrentUser ? chalk.cyan(entry.displayName) : entry.displayName).toString().slice(0, 22).padEnd(25);
            const tokensStr = formatTokens(entry.totalTokens).padEnd(15);
            const tierStr = entry.tier.padEnd(10);
            const row = `  ${rankStr}${userStr}${tokensStr}${tierStr}`;
            lines.push(pad + chalk.cyan('║') + padEndAnsi(row, width - 2) + chalk.cyan('║'));
        }
    }

    lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╟' + '─'.repeat(width - 2) + '╢'));
    lines.push(pad + chalk.cyan('║') + centerText(chalk.dim(t('leaderboardControls')), width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╚' + '═'.repeat(width - 2) + '╝'));

    logUpdate(lines.join('\n'));
}

/**
 * Render help view with same styling
 */
function renderHelp(state: DashboardState, options: DashboardOptions): void {
    const termWidth = process.stdout.columns || 80;
    const width = Math.min(termWidth, 80);
    const leftPad = Math.max(0, Math.floor((termWidth - width) / 2));
    const pad = ' '.repeat(leftPad);

    const lines: string[] = [];

    lines.push(pad + chalk.cyan('╔' + '═'.repeat(width - 2) + '╗'));
    lines.push(pad + chalk.cyan('║') + centerText(chalk.bold('? agy-top Help'), width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╠' + '═'.repeat(width - 2) + '╣'));
    lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('║') + padEndAnsi(chalk.dim('  KEYBOARD SHORTCUTS'), width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('║') + padEndAnsi(`  ${chalk.cyan('q')}     Quit`, width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('║') + padEndAnsi(`  ${chalk.cyan('r')}     Refresh data`, width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('║') + padEndAnsi(`  ${chalk.cyan('l')}     Show leaderboard`, width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('║') + padEndAnsi(`  ${chalk.cyan('s')}     Submit usage data`, width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('║') + padEndAnsi(`  ${chalk.cyan('?')}     Show this help`, width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╟' + '─'.repeat(width - 2) + '╢'));
    lines.push(pad + chalk.cyan('║') + centerText(chalk.dim('Press any key to return to dashboard...'), width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╚' + '═'.repeat(width - 2) + '╝'));

    logUpdate(lines.join('\n'));
}

/**
 * Render submit view with same styling
 */
function renderSubmit(state: DashboardState, _options: DashboardOptions): void {
    const termWidth = process.stdout.columns || 80;
    const width = Math.min(termWidth, 80);
    const leftPad = Math.max(0, Math.floor((termWidth - width) / 2));
    const pad = ' '.repeat(leftPad);

    // Clean message: replace emoji with ASCII for consistent width
    const cleanMessage = (state.submitMessage || 'Processing...')
        .replace(/✓/g, '[OK]')
        .replace(/✗/g, '[X]')
        .replace(/⚠/g, '[!]')
        .replace(/△/g, '[!]');

    const lines: string[] = [];

    lines.push(pad + chalk.cyan('╔' + '═'.repeat(width - 2) + '╗'));
    lines.push(pad + chalk.cyan('║') + centerText(chalk.bold('Submit Usage Data'), width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╠' + '═'.repeat(width - 2) + '╣'));
    lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('║') + centerText(chalk.yellow(cleanMessage), width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╟' + '─'.repeat(width - 2) + '╢'));
    lines.push(pad + chalk.cyan('║') + centerText(chalk.dim('Press any key to return to dashboard...'), width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╚' + '═'.repeat(width - 2) + '╝'));

    logUpdate(lines.join('\n'));
}

