export interface RankData {
  date: string;
  time: string;
  keyword: string;
  rank: number;
  previousDayChange: number;
  searchResults: string;
  searchVolume: number;
  estimatedAccess: number;
  searchFeatures: string;
  competitiveness: number;
  group: string[];
  priorityUrl: string;
  title: string;
  rankingUrl: string;
  memo: string;
  country: string;
}

export interface RankCheckConfig {
  nobilistEmail: string;
  nobilistPassword: string;
  spreadsheetId: string;
  googleCredentialsPath?: string;
  slackWebhookUrl?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SlackNotifyOptions {
  message: string;
  webhookUrl: string;
  channel?: string;
  threadTs?: string;
  broadcastToChannel?: boolean;
  username?: string;
  iconEmoji?: string;
}

export interface AnalysisResult {
  rankPercent: {
    '1-3': number;
    '4-10': number;
    '11-50': number;
    others: number;
  };
  rankCounts: {
    '1-3': number;
    '4-10': number;
    '11-50': number;
    others: number;
  };
  changeStats: {
    improved: number;
    worsened: number;
    unchanged: number;
    bigWinners: Array<{keyword: string; ranking: number; change: number}>;
    bigLosers: Array<{keyword: string; ranking: number; change: number}>;
  };
  total: number;
}