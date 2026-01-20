/**
 * Crypto utilities for agy-top
 * Provides HMAC signature generation for data integrity
 */

import { createHmac, randomBytes } from 'crypto';
import { getInstallationId, getUserId } from './config.js';

/**
 * Generate HMAC-SHA256 checksum for usage data
 */
export function generateChecksum(data: {
    periodStart: string;
    periodEnd: string;
    inputTokens: number;
    outputTokens: number;
    sessionCount: number;
}): string {
    const secret = deriveSecret();
    const payload = JSON.stringify({
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        sessionCount: data.sessionCount,
        timestamp: Date.now(),
    });
    return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Generate cumulative checksum including previous
 */
export function generateCumulativeChecksum(
    currentData: {
        periodStart: string;
        periodEnd: string;
        inputTokens: number;
        outputTokens: number;
        sessionCount: number;
    },
    previousChecksum: string
): string {
    const secret = deriveSecret();
    const payload = JSON.stringify({
        ...currentData,
        previousChecksum,
        timestamp: Date.now(),
    });
    return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Derive a secret key from installation ID and user ID
 */
function deriveSecret(): string {
    const installationId = getInstallationId();
    const userId = getUserId() || 0;
    return createHmac('sha256', 'agy-top-v1')
        .update(`${installationId}:${userId}`)
        .digest('hex');
}

/**
 * Generate a random nonce
 */
export function generateNonce(): string {
    return randomBytes(16).toString('hex');
}
