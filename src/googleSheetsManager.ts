import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { RankData } from './types';

export default class GoogleSheetsManager {
  private sheets: any;
  private auth: any = null;
  private readonly spreadsheetId: string;

  constructor(spreadsheetId: string) {
    this.spreadsheetId = spreadsheetId;
  }

  async init(credentialsPath: string): Promise<void> {
    try {
      const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf-8'));
      
      // サービスアカウントの認証情報を使用
      if (credentials.type === 'service_account') {
        this.auth = new google.auth.GoogleAuth({
          keyFile: credentialsPath,
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        console.log('✅ Google Sheets API（サービスアカウント）を初期化しました');
        return;
      }
      
      // OAuth2クライアントの場合
      this.auth = new google.auth.OAuth2(
        credentials.installed?.client_id,
        credentials.installed?.client_secret,
        credentials.installed?.redirect_uris?.[0]
      );

      const tokenPath = path.join(path.dirname(credentialsPath), 'token.json');
      
      try {
        const token = JSON.parse(await fs.readFile(tokenPath, 'utf-8'));
        this.auth.setCredentials(token);
      } catch (error) {
        console.log('トークンが見つかりません。認証が必要です。');
        throw new Error('Google認証が必要です。');
      }

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('✅ Google Sheets APIを初期化しました');
    } catch (error) {
      console.error('❌ Google Sheets API初期化エラー:', error);
      throw error;
    }
  }

  async updateRankDataMatrix(data: RankData[]): Promise<void> {
    if (!this.sheets) {
      throw new Error('Google Sheets APIが初期化されていません');
    }

    try {
      // 現在のスプレッドシートデータを取得
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Nobilist!A:ZZ'
      });

      let values = response.data.values || [];
      
      // ヘッダー行がない場合は作成
      if (values.length === 0) {
        values.push(['キーワード', 'URL']);
      }
      
      const headerRow = values[0];
      const keywordColumn: string[] = values.slice(1).map((row: any[]) => row[0] || '');
      
      // データを日付ごとにグループ化
      const dataByDate = new Map<string, Map<string, RankData>>();
      for (const item of data) {
        if (!dataByDate.has(item.date)) {
          dataByDate.set(item.date, new Map());
        }
        dataByDate.get(item.date)!.set(item.keyword, item);
      }
      
      // 各日付のデータを処理
      for (const [date, keywordData] of dataByDate) {
        // 日付列を探すか新規作成
        let dateColumnIndex = headerRow.indexOf(date);
        if (dateColumnIndex === -1) {
          headerRow.push(date);
          dateColumnIndex = headerRow.length - 1;
        }
        
        // 各キーワードのデータを配置
        for (const [keyword, rankData] of keywordData) {
          // キーワード行を探すか新規作成
          let keywordRowIndex = keywordColumn.indexOf(keyword);
          if (keywordRowIndex === -1) {
            keywordColumn.push(keyword);
            keywordRowIndex = keywordColumn.length - 1;
            
            // 新しい行を作成（キーワード＋URL）
            if (!values[keywordRowIndex + 1]) {
              // URLを取得（複数URLは改行で区切り）
              const url = rankData.rankingUrl || '';
              values[keywordRowIndex + 1] = [keyword, url];
            }
          }
          
          // 順位データを配置
          const actualRowIndex = keywordRowIndex + 1;
          if (!values[actualRowIndex]) {
            values[actualRowIndex] = [];
          }
          
          // 配列を必要なサイズまで拡張
          while (values[actualRowIndex].length <= dateColumnIndex) {
            values[actualRowIndex].push('');
          }
          
          // URLを更新（B列に設定）- 複数URLの場合は改行で区切り
          if (rankData.rankingUrl && values[actualRowIndex].length >= 2) {
            values[actualRowIndex][1] = rankData.rankingUrl;
          }
          
          values[actualRowIndex][dateColumnIndex] = rankData.rank.toString();
        }
      }
      
      // スプレッドシート全体を更新
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'Nobilist!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: values
        }
      });
      
      console.log(`✅ ${data.length}件のデータをマトリックス形式で更新しました`);
    } catch (error) {
      console.error('❌ データ更新エラー:', error);
      throw error;
    }
  }

  async initializeMatrixSheet(): Promise<void> {
    if (!this.sheets) {
      throw new Error('Google Sheets APIが初期化されていません');
    }

    try {
      // Nobilistシートが存在するか確認
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Nobilist!A1'
      });

      // A1にヘッダーがなければ追加
      if (!response.data.values || response.data.values.length === 0 || response.data.values[0][0] !== 'キーワード') {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'Nobilist!A1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['キーワード']]
          }
        });
        console.log('✅ マトリックス形式のヘッダーを初期化しました');
      }
    } catch (error) {
      console.error('❌ シート初期化エラー:', error);
      throw error;
    }
  }

  // 削除: マトリックス形式を使用するため不要
}