/**
 * Rank Command
 * View the leaderboard
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ApiClient } from '../api/client.js';
import { isAuthenticated } from '../utils/config.js';
import * as output from '../utils/output.js';

export const rankCommand = new Command('rank')
    .description('View the agy-top leaderboard')
    .option('-p, --period <period>', 'Time period: daily, weekly, monthly, all_time', 'weekly')
    .option('-l, --limit <number>', 'Number of entries to show', '20')
    .action(async (options) => {
        const period = options.period as 'daily' | 'weekly' | 'monthly' | 'all_time';
        const limit = parseInt(options.limit, 10);

        output.header('🏆 agy-top Leaderboard');

        const spin = output.spinner('Fetching leaderboard...').start();

        try {
            const data = await ApiClient.getLeaderboard({ period, limit });
            spin.stop();

            // Show period info
            output.info(`${formatPeriod(period)} Rankings`);
            output.newline();

            if (data.entries.length === 0) {
                output.dim('No entries yet. Be the first to submit!');
                output.newline();
                if (!isAuthenticated()) {
                    output.dim('Run "agy-top login" to authenticate and start submitting.');
                }
                return;
            }

            // Create table
            const table = new Table({
                head: [
                    chalk.dim('Rank'),
                    chalk.dim('User'),
                    chalk.dim('Total Tokens'),
                    chalk.dim('Sessions'),
                    chalk.dim('Tier'),
                ],
                style: {
                    head: [],
                    border: ['dim'],
                },
                chars: {
                    'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
                    'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
                    'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
                    'right': '│', 'right-mid': '┤', 'middle': '│'
                }
            });

            // Add entries
            for (const entry of data.entries) {
                const rankIcon = getRankIcon(entry.rank);
                const userStyle = entry.isCurrentUser ? chalk.cyan.bold : chalk.white;

                table.push([
                    `${rankIcon} ${entry.rank}`,
                    userStyle(entry.displayName),
                    output.formatTokens(entry.totalTokens),
                    entry.sessionCount.toString(),
                    formatTier(entry.tier),
                ]);
            }

            console.log(table.toString());

            // Show user's rank if authenticated
            if (isAuthenticated() && data.userRank) {
                output.newline();
                output.info(`Your rank: #${data.userRank} of ${data.totalParticipants} participants`);
            }

            output.newline();
            output.dim(`Total participants: ${data.totalParticipants}`);

        } catch (error) {
            spin.stop();
            const message = error instanceof Error ? error.message : 'Unknown error';
            output.error(`Failed to fetch leaderboard: ${message}`);
            process.exit(1);
        }
    });

function getRankIcon(rank: number): string {
    switch (rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return '  ';
    }
}

function formatPeriod(period: string): string {
    switch (period) {
        case 'daily': return 'Daily';
        case 'weekly': return 'Weekly';
        case 'monthly': return 'Monthly';
        case 'all_time': return 'All-Time';
        default: return period;
    }
}

function formatTier(tier: string): string {
    switch (tier.toLowerCase()) {
        case 'premium': return chalk.magenta('Premium');
        case 'pro': return chalk.blue('Pro');
        case 'basic': return chalk.green('Basic');
        default: return chalk.dim('Free');
    }
}

/**
 * Show rank (exportable for dashboard integration)
 */
export async function showRank(options: { period?: string; limit?: number } = {}): Promise<void> {
    const period = (options.period || 'weekly') as 'daily' | 'weekly' | 'monthly' | 'all_time';
    const limit = options.limit || 20;

    output.header('🏆 agy-top Leaderboard');

    const spin = output.spinner('Fetching leaderboard...').start();

    try {
        const data = await ApiClient.getLeaderboard({ period, limit });
        spin.stop();

        output.info(`${formatPeriod(period)} Rankings`);
        output.newline();

        if (data.entries.length === 0) {
            output.dim('No entries yet. Be the first to submit!');
            return;
        }

        const table = new Table({
            head: [
                chalk.dim('Rank'),
                chalk.dim('User'),
                chalk.dim('Total Tokens'),
                chalk.dim('Sessions'),
                chalk.dim('Tier'),
            ],
            style: { head: [], border: ['dim'] },
            chars: {
                'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
                'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
                'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
                'right': '│', 'right-mid': '┤', 'middle': '│'
            }
        });

        for (const entry of data.entries) {
            const rankIcon = getRankIcon(entry.rank);
            const userStyle = entry.isCurrentUser ? chalk.cyan.bold : chalk.white;

            table.push([
                `${rankIcon} ${entry.rank}`,
                userStyle(entry.displayName),
                output.formatTokens(entry.totalTokens),
                entry.sessionCount.toString(),
                formatTier(entry.tier),
            ]);
        }

        console.log(table.toString());

        if (isAuthenticated() && data.userRank) {
            output.newline();
            output.info(`Your rank: #${data.userRank} of ${data.totalParticipants} participants`);
        }

        output.dim(`Total participants: ${data.totalParticipants}`);

    } catch (error) {
        spin.stop();
        const message = error instanceof Error ? error.message : 'Unknown error';
        output.error(`Failed to fetch leaderboard: ${message}`);
    }
}
