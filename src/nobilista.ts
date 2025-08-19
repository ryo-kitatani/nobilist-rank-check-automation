import { Browser, chromium, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import RankDataManager from "./rankDataManager";
import { LoginCredentials } from "./types";

class NobilistaClient {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: process.env.NODE_ENV === "production",
    });
    this.page = await this.browser.newPage();

    // ブラウザコンテキストでダウンロード設定
    const context = await this.browser.newContext({
      acceptDownloads: true,
    });

    this.page = await context.newPage();
  }

  async login(credentials: LoginCredentials): Promise<boolean> {
    if (!this.page) {
      throw new Error("Browser page is not initialized.");
    }
    try {
      console.log('Nobilistaにログイン中...♻️');
      await this.page.goto("https://nobilista.com/login");
      await this.page.fill('input[name="email"]', credentials.email);
      await this.page.fill('input[name="password"]', credentials.password);
      await this.page.click('button[name="loginBtn"]');
      return true;

    } catch (error) {
      console.error('ログインエラー:', (error as Error).message);
      return false;
    }
  }

  async downloadCSV(): Promise<string| null> {
    if (!this.page) {
      throw new Error("Browser page is not initialized.");
    }

    try {
      // レポート詳細ページへ移動（coeteco.jpの例）
      await this.page.getByRole('cell', { name: 'coeteco.jp - Google' }).getByRole('link').click();

      // CSVボタンクリック
      await this.page.getByRole('button', { name: 'CSV' }).click();

      // 表示中のレポートを取得するを選択
      await this.page.getByText('表示中のレポートを取得する').click();

      // ダウンロード待機設定
      const downloadPromise = this.page.waitForEvent('download');

      // ダウンロードボタンクリック
      await this.page.getByRole('button', { name: 'ダウンロード' }).click();

      // ダウンロード完了待機
      const download = await downloadPromise;

      // ファイル名生成（日付付き）
      const today = new Date().toISOString().split('T')[0];
      const fileName = `nobilista_ranks_${today}.csv`;
      const filePath = path.join('./downloads', fileName);

      // ディレクトリが存在しない場合は作成
      const downloadDir = './downloads';
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      // ファイル保存
      await download.saveAs(filePath);
      return filePath;

    } catch (error) {
      console.error('CSVダウンロードエラー:', (error as Error).message);
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

export default NobilistaClient;