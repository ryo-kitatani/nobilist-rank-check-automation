import RankCheckService from './rankCheckService';
import * as dotenv from 'dotenv';

// 環境変数読み込み
dotenv.config();

async function runRankCheck() {
  const service = new RankCheckService({
    nobilistaEmail: process.env.NOBILISTA_EMAIL!,
    nobilistaPassword: process.env.NOBILISTA_PASSWORD!,
    spreadsheetId: process.env.SPREADSHEET_ID || '',
    googleCredentialsPath: process.env.GOOGLE_CREDENTIALS_PATH,
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL
  });

  await service.execute();
}

// ローカル実行
runRankCheck().catch(error => {
  console.error('❌ 予期しないエラー:', error);
  process.exit(1);
});