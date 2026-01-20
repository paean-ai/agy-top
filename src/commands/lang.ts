/**
 * Language Command
 * Switch between English and Chinese
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getLocale, setLocale, type SupportedLocale } from '../utils/i18n.js';

export const langCommand = new Command('lang')
    .description('Switch language / 切换语言')
    .argument('[locale]', 'Language code: en (English) or zh (中文)')
    .action((locale?: string) => {
        const currentLocale = getLocale();

        if (!locale) {
            // Show current and available languages
            console.log(chalk.bold('Current language / 当前语言:'), currentLocale === 'en' ? 'English' : '中文');
            console.log();
            console.log(chalk.dim('Available languages / 可用语言:'));
            console.log(`  ${currentLocale === 'en' ? chalk.cyan('▶') : ' '} en - English`);
            console.log(`  ${currentLocale === 'zh' ? chalk.cyan('▶') : ' '} zh - 中文`);
            console.log();
            console.log(chalk.dim('Usage / 用法: agy-top lang <en|zh>'));
            return;
        }

        const normalizedLocale = locale.toLowerCase();
        if (normalizedLocale !== 'en' && normalizedLocale !== 'zh') {
            console.log(chalk.red('Invalid language. Use "en" or "zh".'));
            console.log(chalk.red('无效的语言选项。请使用 "en" 或 "zh"。'));
            return;
        }

        setLocale(normalizedLocale as SupportedLocale);

        if (normalizedLocale === 'en') {
            console.log(chalk.green('✓ Language set to English'));
        } else {
            console.log(chalk.green('✓ 语言已切换为中文'));
        }
    });
