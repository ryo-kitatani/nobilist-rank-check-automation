import RankCheckService from './rankCheckService';
import * as dotenv from 'dotenv';

// 環境変数読み込み
dotenv.config();

async function main() {
  const service = new RankCheckService({
    nobilistEmail: process.env.NOBILIST_EMAIL!,
    nobilistPassword: process.env.NOBILIST_PASSWORD!,
    spreadsheetId: '1suoQqpEBwvVYYVTM5LKjAUP6m0XQE0iO22Apnd7Mu4s',
    googleCredentialsPath: process.env.GOOGLE_CREDENTIALS_PATH,
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL
  });

  await service.execute();
}

// 実行
main().catch(error => {
  console.error('❌ 予期しないエラー:', error);
  process.exit(1);
});