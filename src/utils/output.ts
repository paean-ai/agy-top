/**
 * Output utilities for agy-top
 * Provides consistent console output formatting
 */

import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import figures from 'figures';

/**
 * Print a header
 */
export function header(text: string): void {
    console.log();
    console.log(chalk.bold.cyan(`╭─ ${text} ─╮`));
    console.log();
}

/**
 * Print a success message
 */
export function success(text: string): void {
    console.log(chalk.green(`${figures.tick} ${text}`));
}

/**
 * Print an error message
 */
export function error(text: string): void {
    console.log(chalk.red(`${figures.cross} ${text}`));
}

/**
 * Print a warning message
 */
export function warning(text: string): void {
    console.log(chalk.yellow(`${figures.warning} ${text}`));
}

/**
 * Print an info message
 */
export function info(text: string): void {
    console.log(chalk.blue(`${figures.info} ${text}`));
}

/**
 * Print dimmed text
 */
export function dim(text: string): void {
    console.log(chalk.dim(text));
}

/**
 * Print a newline
 */
export function newline(): void {
    console.log();
}

/**
 * Print a key-value pair in table format
 */
export function tableRow(key: string, value: string): void {
    console.log(`  ${chalk.dim(key + ':')} ${value}`);
}

/**
 * Create a spinner
 */
export function spinner(text: string): Ora {
    return ora({
        text,
        spinner: 'dots',
        color: 'cyan',
    });
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
    return num.toLocaleString();
}

/**
 * Format tokens for display
 */
export function formatTokens(tokens: number): string {
    if (tokens >= 1_000_000) {
        return `${(tokens / 1_000_000).toFixed(1)}M`;
    }
    if (tokens >= 1_000) {
        return `${(tokens / 1_000).toFixed(1)}K`;
    }
    return tokens.toString();
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
    return `$${cost.toFixed(2)}`;
}

/**
 * Create ASCII progress bar
 */
export function progressBar(percentage: number, width: number = 30): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return bar;
}

/**
 * Create mini bar for trends
 */
export function miniBar(percentage: number, width: number = 6): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
}
