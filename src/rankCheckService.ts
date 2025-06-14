import NobilistClient from './nobilist';
import RankDataManager from './rankDataManager';
import GoogleSheetsManager from './googleSheetsManager';
import SlackNotifier from './slackNotifier';
import { RankCheckConfig, RankData } from './types';

export default class RankCheckService {
  private config: RankCheckConfig;
  private client: NobilistClient;
  private dataManager: RankDataManager;
  private sheetsManager: GoogleSheetsManager;
  private slackNotifier?: SlackNotifier;

  constructor(config: RankCheckConfig) {
    this.config = config;
    this.client = new NobilistClient();
    this.dataManager = new RankDataManager();
    this.sheetsManager = new GoogleSheetsManager(config.spreadsheetId);
    if (config.slackWebhookUrl) {
      this.slackNotifier = new SlackNotifier(config.slackWebhookUrl);
    }
  }

  async execute(): Promise<void> {
    try {
      await this.initialize();
      const csvPath = await this.downloadCSV();
      
      if (csvPath) {
        const rankData = await this.parseLocalData(csvPath);
        const today = new Date().toISOString().split('T')[0];
        
        // 今日の日付のデータのみをフィルタリング
        const todayData = rankData.filter(item => item.date === today);
        console.log(`📊 処理対象: ${today}のデータ ${todayData.length}件 / 全データ ${rankData.length}件`);
        
        await this.syncToGoogleSheets(todayData);
        await this.sendSlackNotification(todayData);
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
      email: this.config.nobilistEmail,
      password: this.config.nobilistPassword
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
      
      // マトリックス形式でシートを初期化
      await this.sheetsManager.initializeMatrixSheet();
      
      // マトリックス形式でデータを更新
      await this.sheetsManager.updateRankDataMatrix(rankData);
      
      // 割合傾向タブに割合データを書き込み
      await this.sheetsManager.writePercentageToGoogleSheets(rankData);
      
      console.log('✅ Google Spreadsheetへの転記完了！');
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