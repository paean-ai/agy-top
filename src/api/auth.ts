/**
 * Authentication API for agy-top
 * Handles browser OAuth flow
 */

import { createServer, type Server } from 'http';
import { URL } from 'url';
import open from 'open';
import { getApiClient, getPublicApiClient, resetApiClients } from './client.js';
import { storeAuth, clearAuth, getWebUrl } from '../utils/config.js';
import * as output from '../utils/output.js';
import type { UserInfo } from '../types/index.js';

export interface QrSessionResponse {
    success: boolean;
    sessionId: string;
    expiresAt: string;
    expiresInSeconds: number;
    qrContent: string;
}

export interface QrStatusResponse {
    success: boolean;
    status: 'pending' | 'scanned' | 'confirmed' | 'expired' | 'used';
    token?: string;
    userId?: number;
    isExpired?: boolean;
    expiresAt?: string;
}

/**
 * Perform browser-based OAuth login
 * Opens browser and starts local server to receive callback
 */
export async function browserLogin(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
        // Find an available port
        const port = 9876 + Math.floor(Math.random() * 100);
        const callbackUrl = `http://localhost:${port}/callback`;

        let server: Server | null = null;
        let timeoutId: NodeJS.Timeout | null = null;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (server) {
                server.close();
                server = null;
            }
        };

        // Create local server to receive callback
        server = createServer((req, res) => {
            const url = new URL(req.url || '/', `http://localhost:${port}`);

            if (url.pathname === '/callback') {
                const token = url.searchParams.get('token');
                const error = url.searchParams.get('error');
                const userId = url.searchParams.get('userId');
                const email = url.searchParams.get('email');

                // Send response to browser
                res.writeHead(200, { 'Content-Type': 'text/html' });

                if (token) {
                    res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>Login Successful</title>
                <style>
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    text-align: center; 
                    padding: 50px; 
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%); 
                    color: #fff;
                    min-height: 100vh;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                  }
                  .icon { font-size: 64px; margin-bottom: 16px; }
                  h1 { color: #22c55e; margin-bottom: 8px; }
                  p { color: #a3a3a3; }
                  .brand { 
                    margin-top: 40px;
                    font-size: 14px;
                    color: #666;
                  }
                </style>
              </head>
              <body>
                <div class="icon">✅</div>
                <h1>Login Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
                <p class="brand">agy-top • Antigravity Usage Statistics</p>
              </body>
            </html>
          `);

                    // Store authentication
                    storeAuth({
                        token,
                        userId: userId ? parseInt(userId, 10) : undefined,
                        email: email || undefined,
                    });
                    resetApiClients();

                    cleanup();
                    resolve({ success: true });
                } else {
                    res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>Login Failed</title>
                <style>
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    text-align: center; 
                    padding: 50px; 
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%); 
                    color: #fff;
                    min-height: 100vh;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                  }
                  .icon { font-size: 64px; margin-bottom: 16px; }
                  h1 { color: #ef4444; margin-bottom: 8px; }
                  p { color: #a3a3a3; }
                </style>
              </head>
              <body>
                <div class="icon">❌</div>
                <h1>Login Failed</h1>
                <p>${error || 'An error occurred during login.'}</p>
                <p>Please return to the terminal and try again.</p>
              </body>
            </html>
          `);

                    cleanup();
                    resolve({ success: false, error: error || 'Login failed' });
                }
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        server.on('error', (err) => {
            cleanup();
            resolve({ success: false, error: `Server error: ${err.message}` });
        });

        server.listen(port, async () => {
            // Open browser to login page
            const webUrl = getWebUrl();
            const loginUrl = `${webUrl}/auth/cli?callback=${encodeURIComponent(callbackUrl)}&app=agy-top`;

            output.info('Opening browser for login...');
            output.dim(`If browser doesn't open, visit: ${loginUrl}`);
            output.newline();

            try {
                await open(loginUrl);
            } catch {
                output.warning('Could not open browser automatically.');
                output.info(`Please open this URL manually: ${loginUrl}`);
            }

            output.info('Waiting for login...');

            // Set timeout (5 minutes)
            timeoutId = setTimeout(() => {
                cleanup();
                resolve({ success: false, error: 'Login timed out. Please try again.' });
            }, 5 * 60 * 1000);
        });
    });
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<UserInfo | null> {
    try {
        const client = getApiClient();
        const response = await client.get<{ user: UserInfo } | UserInfo>('/user/profile');

        // Handle both response formats
        const data = response.data;
        if ('user' in data) {
            return { ...data.user, tier: 'free' };
        }
        return { ...data, tier: 'free' };
    } catch {
        return null;
    }
}

/**
 * Validate current token
 */
export async function validateToken(): Promise<boolean> {
    try {
        const user = await getCurrentUser();
        return user !== null;
    } catch {
        return false;
    }
}

/**
 * Logout - clear stored credentials
 */
export function logout(): void {
    clearAuth();
    resetApiClients();
}
