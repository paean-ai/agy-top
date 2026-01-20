/**
 * Internationalization (i18n) module for agy-top
 * Supports English and Chinese with user preference storage
 */

import Conf from 'conf';

export type SupportedLocale = 'en' | 'zh';

interface Translations {
    // Dashboard
    detectingServer: string;
    serverFound: string;
    startingDashboard: string;
    serverNotFound: string;
    tipIdeRunning: string;
    uptime: string;
    models: string;
    refreshing: string;
    last: string;
    justNow: string;
    secondsAgo: string;
    minutesAgo: string;
    hoursAgo: string;
    creditsOverview: string;
    prompt: string;
    flow: string;
    modelQuotas: string;
    noModelData: string;
    model: string;
    remaining: string;
    resetsIn: string;
    weeklyTrend: string;
    notAuthenticated: string;
    goodbye: string;

    // Leaderboard
    leaderboard: string;
    loadingLeaderboard: string;
    noEntriesYet: string;
    rank: string;
    user: string;
    tokens: string;
    tier: string;
    sessions: string;

    // Period labels
    periodDaily: string;
    periodWeekly: string;
    periodMonthly: string;
    periodYearly: string;
    periodAllTime: string;

    // Period short labels for tabs
    periodDailyShort: string;
    periodWeeklyShort: string;
    periodMonthlyShort: string;
    periodYearlyShort: string;
    periodAllTimeShort: string;

    // Leaderboard controls
    leaderboardControls: string;
    pressAnyKeyToReturn: string;

    // Help
    help: string;
    keyboardShortcuts: string;
    quit: string;
    refresh: string;
    showLeaderboard: string;
    submitUsageData: string;
    showHelp: string;
    returnToDashboard: string;

    // Controls footer
    controlsRankMode: string;
    controlsBasic: string;

    // Submit
    submitting: string;
    submitSuccess: string;
    submitFlagged: string;
    loginRequired: string;
    noUsageData: string;
    noNewUsage: string;

    // Login
    openingBrowser: string;
    browserOpenFailed: string;
    waitingForLogin: string;
    loginSuccess: string;
    loginFailed: string;
    loginTimedOut: string;

    // Tier labels
    tierPremium: string;
    tierPro: string;
    tierBasic: string;
    tierFree: string;
}

const translations: Record<SupportedLocale, Translations> = {
    en: {
        // Dashboard
        detectingServer: '🔍 Detecting Antigravity Language Server...',
        serverFound: '✓ Found Language Server on port',
        startingDashboard: 'Starting dashboard...',
        serverNotFound: 'Failed to detect Language Server',
        tipIdeRunning: 'Make sure Antigravity IDE is running and try again.',
        uptime: 'Uptime:',
        models: 'Models:',
        refreshing: '⟳ Refreshing...',
        last: 'Last:',
        justNow: 'just now',
        secondsAgo: 's ago',
        minutesAgo: 'm ago',
        hoursAgo: 'h ago',
        creditsOverview: 'CREDITS OVERVIEW',
        prompt: 'Prompt:',
        flow: 'Flow:',
        modelQuotas: 'MODEL QUOTAS',
        noModelData: 'No model quota data available...',
        model: 'MODEL',
        remaining: 'REMAINING',
        resetsIn: 'RESETS IN',
        weeklyTrend: 'WEEKLY TREND',
        notAuthenticated: '⚠ Not authenticated. Run "agy-top login" to submit to leaderboard.',
        goodbye: 'Goodbye! 👋',

        // Leaderboard
        leaderboard: '🏆 agy-top Leaderboard',
        loadingLeaderboard: 'Loading leaderboard...',
        noEntriesYet: 'No entries yet. Be the first to submit!',
        rank: 'RANK',
        user: 'USER',
        tokens: 'TOKENS',
        tier: 'TIER',
        sessions: 'Sessions',

        // Period labels
        periodDaily: 'Daily',
        periodWeekly: 'Weekly',
        periodMonthly: 'Monthly',
        periodYearly: 'Yearly',
        periodAllTime: 'All-Time',

        // Period short labels for tabs
        periodDailyShort: '1:Day',
        periodWeeklyShort: '2:Week',
        periodMonthlyShort: '3:Month',
        periodYearlyShort: '4:Year',
        periodAllTimeShort: '5:All',

        // Leaderboard controls
        leaderboardControls: '[1-5] Switch  [←/→] Navigate  [q] Back',
        pressAnyKeyToReturn: 'Press any key to return to dashboard...',

        // Help
        help: '? agy-top Help',
        keyboardShortcuts: 'KEYBOARD SHORTCUTS',
        quit: 'Quit',
        refresh: 'Refresh data',
        showLeaderboard: 'Show leaderboard',
        submitUsageData: 'Submit usage data',
        showHelp: 'Show this help',
        returnToDashboard: 'Press any key to return to dashboard...',

        // Controls footer
        controlsRankMode: '[q] Quit   [r] Refresh   [l] Leaderboard   [s] Submit   [?] Help',
        controlsBasic: '[q] Quit   [r] Refresh   [?] Help',

        // Submit
        submitting: 'Submitting usage data...',
        submitSuccess: '✓ Submitted! Rank:',
        submitFlagged: 'Submission flagged for review',
        loginRequired: '⚠ Please login first: agy-top login',
        noUsageData: '⚠ No usage data available',
        noNewUsage: 'No new usage to submit',

        // Login
        openingBrowser: 'Opening browser for login...',
        browserOpenFailed: 'Could not open browser automatically.',
        waitingForLogin: 'Waiting for login...',
        loginSuccess: 'Login Successful!',
        loginFailed: 'Login Failed',
        loginTimedOut: 'Login timed out. Please try again.',

        // Tier labels
        tierPremium: 'Premium',
        tierPro: 'Pro',
        tierBasic: 'Basic',
        tierFree: 'Free',
    },
    zh: {
        // Dashboard
        detectingServer: '🔍 正在检测 Antigravity 语言服务器...',
        serverFound: '✓ 发现语言服务器，端口',
        startingDashboard: '正在启动仪表板...',
        serverNotFound: '未能检测到语言服务器',
        tipIdeRunning: '请确保 Antigravity IDE 正在运行后重试。',
        uptime: '运行时间:',
        models: '模型:',
        refreshing: '⟳ 刷新中...',
        last: '上次:',
        justNow: '刚刚',
        secondsAgo: '秒前',
        minutesAgo: '分钟前',
        hoursAgo: '小时前',
        creditsOverview: '额度概览',
        prompt: '提示:',
        flow: '流程:',
        modelQuotas: '模型配额',
        noModelData: '暂无模型配额数据...',
        model: '模型',
        remaining: '剩余',
        resetsIn: '重置于',
        weeklyTrend: '本周趋势',
        notAuthenticated: '⚠ 未登录。运行 "agy-top login" 即可提交到排行榜。',
        goodbye: '再见! 👋',

        // Leaderboard
        leaderboard: '🏆 agy-top 排行榜',
        loadingLeaderboard: '正在加载排行榜...',
        noEntriesYet: '暂无数据，快来成为第一名!',
        rank: '排名',
        user: '用户',
        tokens: 'TOKENS',
        tier: '等级',
        sessions: '会话数',

        // Period labels
        periodDaily: '今日',
        periodWeekly: '本周',
        periodMonthly: '本月',
        periodYearly: '本年',
        periodAllTime: '全部',

        // Period short labels for tabs
        periodDailyShort: '1:日',
        periodWeeklyShort: '2:周',
        periodMonthlyShort: '3:月',
        periodYearlyShort: '4:年',
        periodAllTimeShort: '5:总',

        // Leaderboard controls
        leaderboardControls: '[1-5] 切换  [←/→] 翻页  [q] 返回',
        pressAnyKeyToReturn: '按任意键返回仪表板...',

        // Help
        help: '? agy-top 帮助',
        keyboardShortcuts: '键盘快捷键',
        quit: '退出',
        refresh: '刷新数据',
        showLeaderboard: '显示排行榜',
        submitUsageData: '提交使用数据',
        showHelp: '显示帮助',
        returnToDashboard: '按任意键返回仪表板...',

        // Controls footer
        controlsRankMode: '[q] 退出   [r] 刷新   [l] 排行榜   [s] 提交   [?] 帮助',
        controlsBasic: '[q] 退出   [r] 刷新   [?] 帮助',

        // Submit
        submitting: '正在提交使用数据...',
        submitSuccess: '✓ 提交成功! 排名:',
        submitFlagged: '提交已标记待审核',
        loginRequired: '⚠ 请先登录: agy-top login',
        noUsageData: '⚠ 没有可用的使用数据',
        noNewUsage: '没有新的使用数据可提交',

        // Login
        openingBrowser: '正在打开浏览器登录...',
        browserOpenFailed: '无法自动打开浏览器。',
        waitingForLogin: '等待登录...',
        loginSuccess: '登录成功!',
        loginFailed: '登录失败',
        loginTimedOut: '登录超时，请重试。',

        // Tier labels
        tierPremium: '高级版',
        tierPro: '专业版',
        tierBasic: '基础版',
        tierFree: '免费版',
    },
};

// Config store for persistent locale preference
const config = new Conf<{ locale: SupportedLocale }>({
    projectName: 'agy-top',
    defaults: {
        locale: 'en',
    },
});

let currentLocale: SupportedLocale = config.get('locale');

/**
 * Get current locale
 */
export function getLocale(): SupportedLocale {
    return currentLocale;
}

/**
 * Set locale and persist to config
 */
export function setLocale(locale: SupportedLocale): void {
    currentLocale = locale;
    config.set('locale', locale);
}

/**
 * Get translation for a key
 */
export function t(key: keyof Translations): string {
    return translations[currentLocale][key] || translations['en'][key] || key;
}

/**
 * Get all translations for current locale
 */
export function getTranslations(): Translations {
    return translations[currentLocale];
}

/**
 * Detect system locale and set if available
 */
export function detectSystemLocale(): SupportedLocale {
    const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (systemLocale.startsWith('zh')) {
        return 'zh';
    }
    return 'en';
}

/**
 * Initialize locale - use saved preference or detect from system
 */
export function initLocale(): void {
    const savedLocale = config.get('locale');
    if (!savedLocale) {
        const detected = detectSystemLocale();
        setLocale(detected);
    } else {
        currentLocale = savedLocale;
    }
}
