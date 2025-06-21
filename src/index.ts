import RankCheckService from './rankCheckService';
import * as dotenv from 'dotenv';
import * as http from 'http';

// 環境変数読み込み
dotenv.config();

async function runRankCheck() {
  const service = new RankCheckService({
    nobilistEmail: process.env.NOBILIST_EMAIL!,
    nobilistPassword: process.env.NOBILIST_PASSWORD!,
    spreadsheetId: process.env.SPREADSHEET_ID || '',
    googleCredentialsPath: process.env.GOOGLE_CREDENTIALS_PATH,
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL
  });

  await service.execute();
}

// Cloud Run Job用の実行モード判定
const isCloudRunJob = process.env.K_SERVICE && process.env.K_REVISION;

if (isCloudRunJob) {
  // Cloud Run Job として実行
  console.log('🔷 Cloud Run Job モードで実行します');
  runRankCheck()
    .then(() => {
      console.log('✅ Cloud Run Job 正常終了');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Cloud Run Job エラー:', error);
      process.exit(1);
    });
} else if (process.env.NODE_ENV === 'production') {
  // Cloud Run Service として実行（HTTPサーバー）
  const port = process.env.PORT || 8080;
  
  const server = http.createServer(async (req, res) => {
    console.log(`📨 リクエスト受信: ${req.method} ${req.url}`);
    
    if (req.method === 'POST' && req.url === '/') {
      try {
        console.log('🚀 ランクチェック処理を開始します...');
        await runRankCheck();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'ランクチェック完了' }));
      } catch (error) {
        console.error('❌ エラー:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      }
    } else if (req.method === 'GET' && req.url === '/health') {
      // ヘルスチェック用エンドポイント
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.listen(port, () => {
    console.log(`🌐 サーバーがポート ${port} で起動しました`);
  });
} else {
  // ローカル実行
  runRankCheck().catch(error => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });
}