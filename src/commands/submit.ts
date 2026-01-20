/**
 * Submit Command
 * Manually submit usage data to the leaderboard
 */

import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { UsageCollector } from '../data/collector.js';
import { isAuthenticated, getLastSubmission, storeLastSubmission } from '../utils/config.js';
import { generateCumulativeChecksum } from '../utils/crypto.js';
import * as output from '../utils/output.js';

export const submitCommand = new Command('submit')
    .description('Submit usage data to the leaderboard')
    .option('-f, --force', 'Force submission even if recently submitted')
    .option('--demo', 'Submit demo/mock data (for testing)')
    .action(async (options) => {
        // Check authentication
        if (!isAuthenticated()) {
            output.error('Authentication required to submit data.');
            output.dim('Run "agy-top login" to authenticate.');
            process.exit(1);
        }

        output.header('Submit Usage Data');

        // Check last submission
        const lastSubmission = getLastSubmission();
        if (lastSubmission && !options.force) {
            const lastTime = new Date(lastSubmission.timestamp);
            const hoursSince = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60);

            if (hoursSince < 1) {
                output.warning(`Last submission was ${Math.round(hoursSince * 60)} minutes ago.`);
                output.dim('Use --force to submit anyway, or wait until next hour.');
                return;
            }
        }

        const spin = output.spinner('Collecting usage data...').start();

        try {
            // Collect usage data
            let stats;
            if (options.demo) {
                stats = UsageCollector.getMockStats();
                spin.text = 'Using demo data...';
            } else {
                const collector = new UsageCollector();
                stats = await collector.collect();
            }

            spin.text = 'Preparing submission...';

            // Prepare submission
            const modelBreakdown: Record<string, { inputTokens: number; outputTokens: number; sessions: number }> = {};
            for (const model of stats.modelBreakdown) {
                modelBreakdown[model.model] = {
                    inputTokens: model.inputTokens,
                    outputTokens: model.outputTokens,
                    sessions: model.sessions,
                };
            }

            // Calculate incremental usage
            const lastUsedInput = lastSubmission?.totalUsedInput || 0;
            const lastUsedOutput = lastSubmission?.totalUsedOutput || 0;

            let incrementalInput = stats.inputTokens - lastUsedInput;
            let incrementalOutput = stats.outputTokens - lastUsedOutput;

            // Handle reset
            if (incrementalInput < 0) incrementalInput = stats.inputTokens;
            if (incrementalOutput < 0) incrementalOutput = stats.outputTokens;

            if (incrementalInput <= 0 && incrementalOutput <= 0 && !options.force) {
                spin.stop();
                output.info('No new usage to submit.');
                return;
            }

            const previousChecksum = lastSubmission?.checksum || '0'.repeat(64);
            const cumulativeChecksum = generateCumulativeChecksum(
                {
                    periodStart: stats.periodStart.toISOString(),
                    periodEnd: stats.periodEnd.toISOString(),
                    inputTokens: incrementalInput,
                    outputTokens: incrementalOutput,
                    sessionCount: stats.sessionCount,
                },
                previousChecksum
            );

            spin.text = 'Submitting to server...';

            const result = await ApiClient.submitUsage({
                periodStart: stats.periodStart.toISOString(),
                periodEnd: stats.periodEnd.toISOString(),
                inputTokens: incrementalInput,
                outputTokens: incrementalOutput,
                sessionCount: stats.sessionCount,
                modelBreakdown, // Note: breakdown is still full, ideally should be incremental weighted
                cumulativeChecksum,
                previousChecksum,
                clientVersion: '0.1.0',
            });

            spin.stop();

            if (result.success) {
                output.success('Usage data submitted successfully!');
                output.newline();

                output.tableRow('Input Tokens (New)', output.formatTokens(incrementalInput));
                output.tableRow('Output Tokens (New)', output.formatTokens(incrementalOutput));
                output.tableRow('Sessions', stats.sessionCount.toString());
                output.tableRow('Trust Score', `${result.trustScore}/100`);

                if (result.rank) {
                    output.newline();
                    output.info(`Your current rank: #${result.rank}`);
                }

                // Store submission info with current totals
                storeLastSubmission({
                    timestamp: new Date().toISOString(),
                    checksum: cumulativeChecksum,
                    totalUsedInput: stats.inputTokens,
                    totalUsedOutput: stats.outputTokens
                });

            } else {
                output.error(result.message || 'Submission failed');
                if (result.trustScore < 50) {
                    output.warning(`Low trust score: ${result.trustScore}/100`);
                    output.dim('This may indicate data inconsistency. Contact support if this persists.');
                }
            }

        } catch (error) {
            spin.stop();
            const message = error instanceof Error ? error.message : 'Unknown error';
            output.error(`Failed to submit: ${message}`);
            process.exit(1);
        }
    });

/**
 * Submit usage (exportable for dashboard integration)
 */
export async function submitUsage(): Promise<void> {
    if (!isAuthenticated()) {
        output.error('Authentication required to submit data.');
        output.dim('Run "agy-top login" to authenticate.');
        return;
    }

    output.header('Submit Usage Data');

    const lastSubmission = getLastSubmission();
    if (lastSubmission) {
        const lastTime = new Date(lastSubmission.timestamp);
        const hoursSince = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60);

        if (hoursSince < 1) {
            output.warning(`Last submission was ${Math.round(hoursSince * 60)} minutes ago.`);
            output.dim('Wait until next hour for another submission.');
            return;
        }
    }

    const spin = output.spinner('Collecting usage data...').start();

    try {
        const collector = new UsageCollector();
        const stats = await collector.collect();

        spin.text = 'Preparing submission...';

        const modelBreakdown: Record<string, { inputTokens: number; outputTokens: number; sessions: number }> = {};
        for (const model of stats.modelBreakdown) {
            modelBreakdown[model.model] = {
                inputTokens: model.inputTokens,
                outputTokens: model.outputTokens,
                sessions: model.sessions,
            };
        }

        const lastUsedInput = lastSubmission?.totalUsedInput || 0;
        const lastUsedOutput = lastSubmission?.totalUsedOutput || 0;

        let incrementalInput = stats.inputTokens - lastUsedInput;
        let incrementalOutput = stats.outputTokens - lastUsedOutput;

        if (incrementalInput < 0) incrementalInput = stats.inputTokens;
        if (incrementalOutput < 0) incrementalOutput = stats.outputTokens;

        if (incrementalInput <= 0 && incrementalOutput <= 0) {
            spin.stop();
            // In the library function, we should perhaps return early or log info?
            // Assuming this function is called when explicitly requested.
        }

        const previousChecksum = lastSubmission?.checksum || '0'.repeat(64);
        const cumulativeChecksum = generateCumulativeChecksum(
            {
                periodStart: stats.periodStart.toISOString(),
                periodEnd: stats.periodEnd.toISOString(),
                inputTokens: incrementalInput,
                outputTokens: incrementalOutput,
                sessionCount: stats.sessionCount,
            },
            previousChecksum
        );

        spin.text = 'Submitting to server...';

        const result = await ApiClient.submitUsage({
            periodStart: stats.periodStart.toISOString(),
            periodEnd: stats.periodEnd.toISOString(),
            inputTokens: incrementalInput,
            outputTokens: incrementalOutput,
            sessionCount: stats.sessionCount,
            modelBreakdown,
            cumulativeChecksum,
            previousChecksum,
            clientVersion: '0.1.0',
        });

        spin.stop();

        if (result.success) {
            output.success('Usage data submitted successfully!');
            output.newline();
            output.tableRow('Input Tokens (New)', output.formatTokens(incrementalInput));
            output.tableRow('Output Tokens (New)', output.formatTokens(incrementalOutput));
            output.tableRow('Sessions', stats.sessionCount.toString());
            output.tableRow('Trust Score', `${result.trustScore}/100`);

            if (result.rank) {
                output.newline();
                output.info(`Your current rank: #${result.rank}`);
            }

            storeLastSubmission({
                timestamp: new Date().toISOString(),
                checksum: cumulativeChecksum,
                totalUsedInput: stats.inputTokens,
                totalUsedOutput: stats.outputTokens
            });
        } else {
            output.error(result.message || 'Submission failed');
        }

    } catch (error) {
        spin.stop();
        const message = error instanceof Error ? error.message : 'Unknown error';
        output.error(`Failed to submit: ${message}`);
    }
}
