#!/usr/bin/env node
/**
 * agy-top CLI
 * ASCII-styled usage statistics for Antigravity with leaderboard
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { rankCommand } from './commands/rank.js';
import { submitCommand } from './commands/submit.js';
import { runDashboard } from './ui/run.js';
import { getConfigPath, isAuthenticated } from './utils/config.js';

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
    .name('agy-top')
    .description('ASCII-styled usage statistics for Antigravity with leaderboard')
    .version(packageJson.version)
    .option('--config', 'Show config file path')
    .option('-r, --rank', 'Enable leaderboard mode (requires auth)')
    .option('-n, --no-refresh', 'Disable auto-refresh')
    .option('-i, --interval <seconds>', 'Refresh interval in seconds', '10')
    .option('-d, --debug', 'Enable debug logging')
    .action(async (options) => {
        if (options.config) {
            console.log(getConfigPath());
            return;
        }

        // Auto-enable rank mode when user is authenticated
        const rankMode = options.rank || isAuthenticated();

        // Default action: show dashboard
        await runDashboard({
            rankMode,
            autoRefresh: options.refresh !== false,
            refreshInterval: parseInt(options.interval, 10) * 1000,
            debug: options.debug || false,
        });
    });

// Register commands
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(rankCommand);
program.addCommand(submitCommand);

// Parse arguments
program.parse();
