/**
 * Dashboard runner for agy-top
 * Full-screen ASCII dashboard with real-time updates from Antigravity Language Server
 */

import logUpdate from 'log-update';
import chalk from 'chalk';
import { detectAntigravityServer, type ServerInfo } from '../data/server-detector.js';
import { fetchQuota, type QuotaSnapshot } from '../data/quota-service.js';
import { isAuthenticated } from '../utils/config.js';
import { formatTokens, progressBar, miniBar } from '../utils/output.js';
import { showRank } from '../commands/rank.js';
import { submitUsage } from '../commands/submit.js';
import type { DashboardOptions, WeeklyTrend } from '../types/index.js';

const VERSION = '0.1.0';

interface DashboardState {
    server: ServerInfo | null;
    snapshot: QuotaSnapshot | null;
    weeklyTrend: WeeklyTrend[];
    uptime: number;
    lastRefresh: Date;
    isLoading: boolean;
    error: string | null;
}

/**
 * Run the dashboard in full-screen mode
 */
export async function runDashboard(options: DashboardOptions): Promise<void> {
    const startTime = Date.now();

    // Clear screen and hide cursor for full-screen mode
    process.stdout.write('\x1B[?25l'); // Hide cursor
    console.clear();

    let state: DashboardState = {
        server: null,
        snapshot: null,
        weeklyTrend: generateMockWeeklyTrend(),
        uptime: 0,
        lastRefresh: new Date(),
        isLoading: true,
        error: null,
    };

    // Initial server detection
    console.log(chalk.dim('🔍 Detecting Antigravity Language Server...'));

    const detection = await detectAntigravityServer();
    if (!detection.success || !detection.server) {
        process.stdout.write('\x1B[?25h'); // Show cursor
        console.log(chalk.red('✗ ' + (detection.error || 'Failed to detect Language Server')));
        if (detection.tip) {
            console.log(chalk.yellow('  Tip: ' + detection.tip));
        }
        console.log(chalk.dim('\nMake sure Antigravity IDE is running and try again.'));
        process.exit(1);
    }

    state.server = detection.server;
    console.log(chalk.green(`✓ Found Language Server on port ${detection.server.port}`));
    console.log(chalk.dim('  Starting dashboard...\n'));

    // Initial data load
    await refreshData(state);
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

        process.stdin.on('data', async (key: string) => {
            if (key === 'q' || key === '\u0003') { // q or Ctrl+C
                cleanup();
            }
            if (key === 'r') {
                state.isLoading = true;
                render(state, options);
                await refreshData(state);
                state.isLoading = false;
                render(state, options);
            }
            if (key === 'l' && options.rankMode) {
                // Show leaderboard
                logUpdate.clear();
                process.stdout.write('\x1B[?25h'); // Show cursor
                console.clear();
                await showRank({ period: 'weekly', limit: 20 });
                console.log(chalk.dim('\nPress any key to return to dashboard...'));
                process.stdin.once('data', () => {
                    process.stdout.write('\x1B[?25l'); // Hide cursor
                    console.clear();
                    render(state, options);
                });
            }
            if (key === 's' && options.rankMode) {
                // Submit usage data
                logUpdate.clear();
                process.stdout.write('\x1B[?25h'); // Show cursor
                console.clear();
                await submitUsage();
                console.log(chalk.dim('\nPress any key to return to dashboard...'));
                process.stdin.once('data', () => {
                    process.stdout.write('\x1B[?25l'); // Hide cursor
                    console.clear();
                    render(state, options);
                });
            }
            if (key === '?') {
                showHelp();
            }
        });
    }

    // Auto-refresh loop
    const refreshLoop = async () => {
        state.uptime = Math.floor((Date.now() - startTime) / 1000);
        render(state, options);

        if (options.autoRefresh) {
            setTimeout(async () => {
                await refreshData(state);
                refreshLoop();
            }, options.refreshInterval);
        }
    };

    refreshLoop();
}

/**
 * Refresh data from Language Server
 */
async function refreshData(state: DashboardState): Promise<void> {
    if (!state.server) return;

    try {
        const result = await fetchQuota(state.server);
        if (result.success && result.snapshot) {
            state.snapshot = result.snapshot;
            state.error = null;
        } else {
            state.error = result.error || 'Failed to fetch quota';
        }
        state.lastRefresh = new Date();
    } catch (error) {
        state.error = error instanceof Error ? error.message : 'Refresh failed';
    }
}

/**
 * Render the full-screen dashboard
 */
function render(state: DashboardState, options: DashboardOptions): void {
    const { snapshot, weeklyTrend, uptime, lastRefresh, isLoading, error } = state;

    // Use full terminal width/height
    const termWidth = process.stdout.columns || 80;
    const termHeight = process.stdout.rows || 24;
    const width = Math.min(termWidth, 100);

    const lines: string[] = [];

    // Add top padding for centering
    const contentHeight = estimateContentHeight(snapshot);
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
        const planName = snapshot.userInfo.planName || '';
        const userLine = `  ${chalk.bold.white(userName)}  ${chalk.dim('│')}  ${chalk.yellow(userTier)}  ${chalk.dim('│')}  ${chalk.cyan(planName)}`;
        lines.push(pad + chalk.cyan('║') + padEndAnsi(userLine, width - 2) + chalk.cyan('║'));
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

            // Build row with fixed column widths
            const row = `  ${modelName.padEnd(nameCol)}${barStr}  ${pctStr}  ${resetStr.padStart(8)}`;
            lines.push(pad + chalk.cyan('║') + padEndAnsi(row, width - 2) + chalk.cyan('║'));
        }

        if (models.length > 7) {
            lines.push(pad + chalk.cyan('║') + padEndAnsi(chalk.dim(`  ... and ${models.length - 7} more models`), width - 2) + chalk.cyan('║'));
        }
    }

    lines.push(pad + chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
    lines.push(pad + chalk.cyan('╟' + '─'.repeat(width - 2) + '╢'));

    // Weekly trend with proper spacing
    lines.push(pad + chalk.cyan('║') + padEndAnsi(chalk.dim('  WEEKLY TREND'), width - 2) + chalk.cyan('║'));
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
 * Pad string to width, accounting for ANSI codes
 */
function padEndAnsi(str: string, width: number): string {
    const visibleLen = stripAnsi(str).length;
    if (visibleLen >= width) return str;
    return str + ' '.repeat(width - visibleLen);
}

/**
 * Estimate content height for centering
 */
function estimateContentHeight(snapshot: QuotaSnapshot | null): number {
    let height = 10; // Base (header, status, footer, etc.)
    if (snapshot?.userInfo) height += 2;
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
 * Center text within a width
 */
function centerText(text: string, width: number): string {
    const textLen = stripAnsi(text).length;
    const padding = Math.max(0, Math.floor((width - textLen) / 2));
    return ' '.repeat(padding) + text + ' '.repeat(width - padding - textLen);
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
