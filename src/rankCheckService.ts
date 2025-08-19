import NobilistaClient from './nobilista';
import RankDataManager from './rankDataManager';
import GoogleSheetsManager from './googleSheetsManager';
import SlackNotifier from './slackNotifier';
import { RankCheckConfig, RankData } from './types';

export default class RankCheckService {
  private config: RankCheckConfig;
  private client: NobilistaClient;
  private dataManager: RankDataManager;
  private sheetsManager: GoogleSheetsManager;
  private slackNotifier?: SlackNotifier;

  constructor(config: RankCheckConfig) {
    this.config = config;
    this.client = new NobilistaClient();
    this.dataManager = new RankDataManager();
    this.sheetsManager = new GoogleSheetsManager(config.spreadsheetId);
    if (config.slackWebhookUrl) {
      this.slackNotifier = new SlackNotifier(config.slackWebhookUrl);
    }
  }

  async execute(): Promise<void> {
    try {
      await this.initialize();
      // const csvPath = 'downloads/nobilista_ranks_2025-06-20.csv';
      const csvPath = await this.downloadCSV();

      if (csvPath) {
        const rankData = await this.parseLocalData(csvPath);
        // 2日前にしたい
        // const two_before_today = new Date();
        // two_before_today.setDate(two_before_today.getDate() - 1);
        // const today = two_before_today.toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        // 今日の日付のデータのみをフィルタリング
        const todayData = rankData.filter(item => item.date === today);
        console.log(`📊 処理対象: ${today}のデータ ${todayData.length}件 / 全データ ${rankData.length}件`);
        
        await this.syncToGoogleSheets(todayData);
        // groupがデジタルメディア_SAランクのみSlack通知する
        const filteredData = todayData.filter(item => item.group.includes('デジタルメディア_SAランク'));
        await this.sendSlackNotification(filteredData);
      }
    } catch (error) {
      console.error('❌ エラー発生:', (error as Error).message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async initialize(): Promise<void> {
    console.log('📍 初期化中...');
    await this.client.init();
  }

  private async downloadCSV(): Promise<string | null> {
    console.log('📍 ログイン中...');
    const loginResult = await this.client.login({
      email: this.config.nobilistaEmail,
      password: this.config.nobilistaPassword
    });

    if (!loginResult) {
      console.log('❌ ログイン失敗');
      return null;
    }

    console.log('✅ ログイン成功！');
    console.log('📍 CSVダウンロード開始...');
    
    const csvPath = await this.client.downloadCSV();
    if (csvPath) {
      console.log(`✅ CSVダウンロード成功: ${csvPath}`);
    } else {
      console.log('❌ CSVダウンロード失敗');
    }
    
    return csvPath;
  }

  private async parseLocalData(csvPath: string): Promise<RankData[]> {
    console.log('📍 データ解析中...');
    return await this.dataManager.parseCSVFile(csvPath);
  }

  private async syncToGoogleSheets(rankData: RankData[]): Promise<void> {
    console.log('\n📍 Google Spreadsheetへの転記を試みています...');
    
    if (!this.config.googleCredentialsPath) {
      console.log('⚠️  Google認証情報が設定されていません（GOOGLE_CREDENTIALS_PATH環境変数）');
      return;
    }

    try {
      await this.sheetsManager.init(this.config.googleCredentialsPath);

      // グループごとにデータを分類
      const dataByGroup = new Map<string, RankData[]>();
      for (const item of rankData) {
        // groupは既に配列としてパース済み
        for (const group of item.group) {
          if (!dataByGroup.has(group)) {
            dataByGroup.set(group, []);
          }
          dataByGroup.get(group)!.push(item);
        }
      }

      // 各グループごとにタブを作成してデータを書き込み
      let processedGroups = 0;
      const totalGroups = dataByGroup.size;

      for (const [group, groupData] of dataByGroup) {
        const sheetName = group || '未分類';
        processedGroups++;
        console.log(`\n📊 グループ「${sheetName}」のデータを処理中... (${groupData.length}件) [${processedGroups}/${totalGroups}]`);

        try {
          // 統合シートに書き込み（割合とキーワードデータを1つのシートに）
          const integratedSheetName = `${sheetName}`;
          await this.sheetsManager.writeIntegratedData(groupData, integratedSheetName);

          console.log(`✅ グループ「${sheetName}」の処理完了`);
        } catch (error) {
          console.error(`❌ グループ「${sheetName}」の処理エラー:`, error);
          // エラーが発生しても他のグループの処理を続行
        }
      }
      
      console.log('\n✅ 全グループのGoogle Spreadsheetへの転記完了！');
    } catch (error) {
      console.log('⚠️  Google Spreadsheet転記エラー:', (error as Error).message);
      console.log('ローカルファイルへの保存は完了しています。');
    }
  }


  private async sendSlackNotification(rankData: RankData[]): Promise<void> {
    if (!this.slackNotifier) {
      console.log('⚠️  Slack Webhook URLが設定されていないため、通知をスキップします');
      return;
    }

    try {
      console.log('\n📍 Slack通知を送信中...');
      const today = new Date().toISOString().split('T')[0];
      // 既にフィルタリング済みのデータを渡す
      await this.slackNotifier.notifyRankingResults(rankData, today);
    } catch (error) {
      console.log('⚠️  Slack通知エラー:', (error as Error).message);
    }
  }

  private async cleanup(): Promise<void> {
    await this.client.close();
    console.log('📍 ブラウザ終了');
  }
}