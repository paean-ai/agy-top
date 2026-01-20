/**
 * Login Command
 * Authenticate with Paean AI using browser OAuth
 */

import { Command } from 'commander';
import { browserLogin, getCurrentUser, validateToken } from '../api/auth.js';
import { isAuthenticated, getEmail } from '../utils/config.js';
import * as output from '../utils/output.js';

export const loginCommand = new Command('login')
    .description('Authenticate with Paean AI (required for leaderboard)')
    .option('--check', 'Check current authentication status')
    .action(async (options) => {
        // Check current status
        if (options.check) {
            await checkAuthStatus();
            return;
        }

        // If already logged in, show status
        if (isAuthenticated()) {
            const email = getEmail();
            output.success(`Already logged in${email ? ` as ${email}` : ''}`);
            output.dim('Use "agy-top logout" to sign out, or "agy-top login --check" to verify.');
            return;
        }

        output.header('agy-top Login');
        output.info('Authentication is required to submit data to the leaderboard.');
        output.newline();

        const spin = output.spinner('Preparing login...').start();

        try {
            spin.stop();
            const result = await browserLogin();

            if (result.success) {
                output.newline();
                output.success('Login successful!');

                // Show user info
                const user = await getCurrentUser();
                if (user) {
                    output.tableRow('Email', user.email);
                    if (user.name) {
                        output.tableRow('Name', user.name);
                    }
                }

                output.newline();
                output.dim('You can now submit usage data to the leaderboard.');
                output.dim('Run "agy-top --rank" to enable leaderboard mode.');
                process.exit(0);
            } else {
                output.newline();
                output.error(result.error || 'Login failed');
                process.exit(1);
            }
        } catch (error) {
            spin.stop();
            const message = error instanceof Error ? error.message : 'Unknown error';
            output.error(`Login failed: ${message}`);
            process.exit(1);
        }
    });

async function checkAuthStatus(): Promise<void> {
    output.header('Authentication Status');

    if (!isAuthenticated()) {
        output.warning('Not logged in');
        output.dim('Use "agy-top login" to authenticate.');
        return;
    }

    const spin = output.spinner('Validating token...').start();

    try {
        const isValid = await validateToken();
        spin.stop();

        if (isValid) {
            const user = await getCurrentUser();
            output.success('Authenticated');

            if (user) {
                output.tableRow('Email', user.email);
                if (user.name) {
                    output.tableRow('Name', user.name);
                }
                output.tableRow('User ID', String(user.id));
                output.tableRow('Tier', user.tier);
            }
        } else {
            output.warning('Token expired or invalid');
            output.dim('Use "agy-top login" to re-authenticate.');
        }
    } catch (error) {
        spin.stop();
        output.warning('Could not validate token');
        output.dim('Use "agy-top login" to re-authenticate.');
    }
}
