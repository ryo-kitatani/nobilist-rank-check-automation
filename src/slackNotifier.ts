import axios from 'axios';
import { RankData, SlackNotifyOptions, AnalysisResult } from './types';

export default class SlackNotifier {
  private readonly webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendToSlack({
    message,
    channel = "#coeteco-dm-product",
    threadTs = "1740819204.046099",
    broadcastToChannel = true,
    username = "Nobilista順位通知",
    iconEmoji = ":nobilista:"
  }: Omit<SlackNotifyOptions, 'webhookUrl'>): Promise<boolean> {
    if (!this.webhookUrl) {
      console.log('Slack Webhook URLが設定されていないため、通知をスキップします');
      return false;
    }

    const payload = {
      text: message,
      ...(channel && { channel }),
      ...(username && { username }),
      ...(iconEmoji && { icon_emoji: iconEmoji }),
      ...(threadTs && {
        thread_ts: threadTs,
        ...(broadcastToChannel && { reply_broadcast: true })
      })
    };

    try {
      const response = await axios.post(this.webhookUrl, payload);
      if (response.status === 200) {
        console.log('✅ Slack通知を送信しました');
        return true;
      } else {
        throw new Error(`ステータスコード: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Slack通知の送信に失敗しました:', (error as Error).message);
      if (axios.isAxiosError(error) && error.response) {
        console.error('レスポンス:', error.response.status, error.response.data);
      }
      throw error;
    }
  }

  analyzeRankData(data: RankData[]): AnalysisResult {
    const total = data.length;
    
    // 順位分布の計算
    const rankCounts = {
      '1-3': 0,
      '4-10': 0,
      '11-50': 0,
      others: 0
    };

    // 順位変化の計算
    let improved = 0;
    let worsened = 0;
    let unchanged = 0;
    const bigWinners: Array<{keyword: string; ranking: number; change: number}> = [];
    const bigLosers: Array<{keyword: string; ranking: number; change: number}> = [];

    for (const item of data) {
      // 順位分布
      if (item.rank >= 1 && item.rank <= 3) {
        rankCounts['1-3']++;
      } else if (item.rank >= 4 && item.rank <= 10) {
        rankCounts['4-10']++;
      } else if (item.rank >= 11 && item.rank <= 50) {
        rankCounts['11-50']++;
      } else {
        // 0以下、51以上、NaNなど全て「それ以下」に分類
        rankCounts.others++;
      }

      // 順位変化
      if (item.previousDayChange > 0) {
        improved++;
        if (item.previousDayChange >= 3) {
          bigWinners.push({
            keyword: item.keyword,
            ranking: item.rank,
            change: item.previousDayChange
          });
        }
      } else if (item.previousDayChange < 0) {
        worsened++;
        if (item.previousDayChange <= -3) {
          bigLosers.push({
            keyword: item.keyword,
            ranking: item.rank,
            change: Math.abs(item.previousDayChange)
          });
        }
      } else {
        unchanged++;
      }
    }

    // パーセンテージ計算
    const rankPercent = {
      '1-3': (rankCounts['1-3'] / total) * 100,
      '4-10': (rankCounts['4-10'] / total) * 100,
      '11-50': (rankCounts['11-50'] / total) * 100,
      others: (rankCounts.others / total) * 100
    };

    return {
      rankPercent,
      rankCounts,
      changeStats: {
        improved,
        worsened,
        unchanged,
        bigWinners,
        bigLosers
      },
      total
    };
  }

  createAnalysisMessage(analysis: AnalysisResult, date: string): string {
    const { rankPercent, rankCounts, changeStats, total } = analysis;

    let message = "";
    message += `Nobilist順位チェッカー順位計測結果（${date})\n\n`;

    message += `■ 順位分布 [<https://docs.google.com/spreadsheets/d/${process.env.SPREADSHEET_ID}/edit?gid=1270629548#gid=1270629548|確認>]\n`;
    message += `1~3位  ：${rankPercent['1-3'].toFixed(2)}% (${rankCounts['1-3']}件)\n`;
    message += `4~10位 ：${rankPercent['4-10'].toFixed(2)}% (${rankCounts['4-10']}件)\n`;
    message += `11~50位：${rankPercent['11-50'].toFixed(2)}% (${rankCounts['11-50']}件)\n`;
    message += `それ以下：${rankPercent.others.toFixed(2)}%(${rankCounts.others}件)\n\n`;

    message += "■ 順位変化 \n";
    message += `上昇：${changeStats.improved}件 (${((changeStats.improved / total) * 100).toFixed(2)}%)\n`;
    message += `下降：${changeStats.worsened}件 (${((changeStats.worsened / total) * 100).toFixed(2)}%)\n`;
    message += `変化なし：${changeStats.unchanged}件 (${((changeStats.unchanged / total) * 100).toFixed(2)}%)\n\n`;

    // 大きく順位が上昇したキーワード
    if (changeStats.bigWinners.length > 0) {
      message += `■ 大きく上昇したキーワード（3位以上）\n`;
      changeStats.bigWinners
        .sort((a, b) => a.change - b.change)
        .forEach(item => {
          message += `・${item.keyword}: ${item.ranking}位 (↑${item.change})\n`;
        });
      message += `\n`;
    }

    // 大きく順位が下降したキーワード
    if (changeStats.bigLosers.length > 0) {
      message += `■ 大きく下降したキーワード（3位以上）\n`;
      changeStats.bigLosers
        .sort((a, b) => b.change - a.change)
        .forEach(item => {
          message += `・${item.keyword}: ${item.ranking}位 (↓${item.change})\n`;
        });
    }

    return message;
  }

  async notifyRankingResults(data: RankData[], date: string): Promise<void> {
    try {
      // rankCheckServiceで既にフィルタリング済みのデータを使用
      const analysis = this.analyzeRankData(data);
      const message = this.createAnalysisMessage(analysis, date);
      await this.sendToSlack({ message });
    } catch (error) {
      console.error('❌ Slack通知処理エラー:', error);
      throw error;
    }
  }
}