/**
 * Logout Command
 * Clear stored credentials
 */

import { Command } from 'commander';
import { logout } from '../api/auth.js';
import { isAuthenticated, getEmail } from '../utils/config.js';
import * as output from '../utils/output.js';

export const logoutCommand = new Command('logout')
    .description('Sign out from Paean AI')
    .action(async () => {
        if (!isAuthenticated()) {
            output.info('You are not logged in.');
            return;
        }

        const email = getEmail();
        logout();

        output.success(`Logged out${email ? ` from ${email}` : ''}`);
        output.dim('Use "agy-top login" to sign in again.');
    });
