import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { RankData } from './types';

export default class GoogleSheetsManager {
  private sheets: any;
  private auth: any = null;
  private spreadsheetId: string;
  private rateLimitDelay: number = 1000; // 1秒の遅延

  constructor(spreadsheetId?: string) {
    this.spreadsheetId = spreadsheetId || '';
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

  async createSpreadsheet(title: string): Promise<string> {
    if (!this.sheets) {
      throw new Error('Google Sheets APIが初期化されていません');
    }

    try {
      const response = await this.sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: title
          },
          sheets: [{
            properties: {
              title: '概要',
              index: 0
            }
          }]
        }
      });

      const spreadsheetId = response.data.spreadsheetId;
      console.log(`✅ 新しいスプレッドシートを作成しました: ${title} (ID: ${spreadsheetId})`);
      return spreadsheetId;
    } catch (error) {
      console.error('❌ スプレッドシート作成エラー:', error);
      throw error;
    }
  }

  async createOrGetSheet(sheetName: string): Promise<void> {
    if (!this.sheets || !this.spreadsheetId) {
      throw new Error('Google Sheets APIが初期化されていません');
    }

    try {
      // レート制限対策の遅延
      await this.delay(this.rateLimitDelay);
      
      // スプレッドシートの情報を取得
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      // シートが存在するか確認
      const sheetExists = spreadsheet.data.sheets.some(
        (sheet: any) => sheet.properties.title === sheetName
      );

      if (!sheetExists) {
        // レート制限対策の遅延
        await this.delay(this.rateLimitDelay);
        
        // シートを作成
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }]
          }
        });
        console.log(`✅ 新しいシートを作成しました: ${sheetName}`);
      }
    } catch (error) {
      console.error('❌ シート作成エラー:', error);
      throw error;
    }
  }

  setSpreadsheetId(spreadsheetId: string): void {
    this.spreadsheetId = spreadsheetId;
  }

  async updateRankDataMatrix(data: RankData[], sheetName: string = 'Nobilista(日次)'): Promise<void> {
    if (!this.sheets) {
      throw new Error('Google Sheets APIが初期化されていません');
    }

    try {
      // 現在のスプレッドシートデータを取得
      // シートが存在することを確認
      await this.createOrGetSheet(sheetName);

      // レート制限対策の遅延
      await this.delay(this.rateLimitDelay);
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:ZZ`
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
        // 日付列を探すか新規作成（C列から開始）
        let dateColumnIndex = headerRow.indexOf(date);
        if (dateColumnIndex === -1) {
          // C列（インデックス2）に新しい日付を挿入
          if (headerRow.length <= 2) {
            // ヘッダーがキーワードとURLのみの場合は追加
            headerRow.push(date);
            dateColumnIndex = 2;
          } else {
            // 既存の日付がある場合は、C列に挿入
            headerRow.splice(2, 0, date);
            dateColumnIndex = 2;

            // 既存のすべての行にも空のセルを挿入
            for (let i = 1; i < values.length; i++) {
              if (values[i]) {
                values[i].splice(2, 0, '');
              }
            }
          }
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
      
      // レート制限対策の遅延
      await this.delay(this.rateLimitDelay);
      
      // スプレッドシート全体を更新
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
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

  async initializeMatrixSheet(sheetName: string = 'Nobilista(日次)'): Promise<void> {
    if (!this.sheets) {
      throw new Error('Google Sheets APIが初期化されていません');
    }

    try {
      // Nobilistシートが存在するか確認
      // シートが存在することを確認
      await this.createOrGetSheet(sheetName);

      // レート制限対策の遅延
      await this.delay(this.rateLimitDelay);
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`
      });

      // A1にヘッダーがなければ追加
      if (!response.data.values || response.data.values.length === 0 || response.data.values[0][0] !== 'キーワード') {
        // レート制限対策の遅延
        await this.delay(this.rateLimitDelay);
        
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['キーワード', 'URL']]
          }
        });
        console.log('✅ マトリックス形式のヘッダーを初期化しました');
      }
    } catch (error) {
      console.error('❌ シート初期化エラー:', error);
      throw error;
    }
  }

  async writePercentageToGoogleSheets(data: RankData[], sheetName: string): Promise<void> {
    if (!this.sheets) {
      throw new Error('Google Sheets APIが初期化されていません');
    }

    try {
      // 分析結果を取得
      const analysis = this.analyzeRankData(data);
      const today = data[0]?.date || new Date().toISOString().split('T')[0];
      
      // シートが存在することを確認
      await this.createOrGetSheet(sheetName);

      // レート制限対策の遅延
      await this.delay(this.rateLimitDelay);
      
      // 現在のシートデータを取得
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`
      });

      let values = response.data.values || [];
      
      // ヘッダー行がない場合は作成
      if (values.length === 0 || values[0][0] !== '割合') {
        values = [
          ['割合', today],
          ['1~3位', analysis.rankPercent['1-3'].toFixed(2)],
          ['4~10位', analysis.rankPercent['4-10'].toFixed(2)],
          ['11~50位', analysis.rankPercent['11-50'].toFixed(2)],
          ['それ以下', analysis.rankPercent.others.toFixed(2)]
        ];
      } else {
        // 既存のデータがある場合、B列（インデックス1）に今日の日付を設定
        // ヘッダー行のB列に日付を設定
        if (!values[0][1]) {
          values[0][1] = today;
        } else if (values[0][1] !== today) {
          // 既存の日付と異なる場合は、新しい列を挿入
          for (let i = 0; i < values.length; i++) {
            if (values[i]) {
              values[i].splice(1, 0, i === 0 ? today : '');
            }
          }
        }
        
        // 既存の行を確認し、必要に応じて作成・更新
        const expectedRows = ['1~3位', '4~10位', '11~50位', 'それ以下'];
        const percentValues = [
          analysis.rankPercent['1-3'].toFixed(2),
          analysis.rankPercent['4-10'].toFixed(2),
          analysis.rankPercent['11-50'].toFixed(2),
          analysis.rankPercent.others.toFixed(2)
        ];
        
        for (let i = 0; i < expectedRows.length; i++) {
          if (!values[i + 1]) {
            values[i + 1] = [expectedRows[i], percentValues[i]];
          } else {
            // A列にラベルを確認・設定
            if (values[i + 1][0] !== expectedRows[i]) {
              values[i + 1][0] = expectedRows[i];
            }
            // B列に値を設定
            values[i + 1][1] = percentValues[i];
          }
        }
      }
      
      // レート制限対策の遅延
      await this.delay(this.rateLimitDelay);
      
      // スプレッドシートを更新
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: values
        }
      });
      
      console.log(`✅ 割合データを「${sheetName}」シートに書き込みました`);
    } catch (error) {
      console.error('❌ 割合データの書き込みエラー:', error);
      throw error;
    }
  }

  private analyzeRankData(data: RankData[]): { rankPercent: { '1-3': number; '4-10': number; '11-50': number; others: number }; total: number } {
    const total = data.length;
    
    // 順位分布の計算
    const rankCounts = {
      '1-3': 0,
      '4-10': 0,
      '11-50': 0,
      others: 0
    };

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
      total
    };
  }

  private getRankCounts(data: RankData[]): { '1-3': number; '4-10': number; '11-50': number; others: number } {
    const rankCounts = {
      '1-3': 0,
      '4-10': 0,
      '11-50': 0,
      others: 0
    };

    for (const item of data) {
      if (item.rank >= 1 && item.rank <= 3) {
        rankCounts['1-3']++;
      } else if (item.rank >= 4 && item.rank <= 10) {
        rankCounts['4-10']++;
      } else if (item.rank >= 11 && item.rank <= 50) {
        rankCounts['11-50']++;
      } else {
        rankCounts.others++;
      }
    }

    return rankCounts;
  }

  // 削除: マトリックス形式を使用するため不要

  /**
   * 統合シートにデータを書き込む（割合データとキーワード順位データを1つのシートに）
   */
  async writeIntegratedData(data: RankData[], sheetName: string): Promise<void> {
    if (!this.sheets) {
      throw new Error('Google Sheets APIが初期化されていません');
    }

    try {
      // シートが存在することを確認
      await this.createOrGetSheet(sheetName);

      // 分析結果を取得
      const analysis = this.analyzeRankData(data);
      const today = data[0]?.date || new Date().toISOString().split('T')[0];

      // レート制限対策の遅延
      await this.delay(this.rateLimitDelay);
      
      // 現在のシートデータを取得
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:ZZ`
      });

      let values = response.data.values || [];
      
      // シートが空の場合、新しく作成
      if (values.length === 0) {
        // 割合セクション（件数も含む）
        const rankCounts = this.getRankCounts(data);
        values = [
          ['割合', '', today],  // B列を空けてC列から日付開始
          ['1~3位', '', `${analysis.rankPercent['1-3'].toFixed(2)} (${rankCounts['1-3']}件)`],
          ['4~10位', '', `${analysis.rankPercent['4-10'].toFixed(2)} (${rankCounts['4-10']}件)`],
          ['11~50位', '', `${analysis.rankPercent['11-50'].toFixed(2)} (${rankCounts['11-50']}件)`],
          ['それ以下', '', `${analysis.rankPercent.others.toFixed(2)} (${rankCounts.others}件)`],
          [], // 空行
          ['キーワード', 'URL', today] // キーワードセクションのヘッダー
        ];

        // キーワードデータを追加
        for (const item of data) {
          values.push([
            item.keyword,
            item.rankingUrl || '',
            item.rank.toString()
          ]);
        }
      } else {
        // 既存のシートがある場合
        
        // 割合セクションを探す
        let percentageEndRow = -1;
        for (let i = 0; i < values.length; i++) {
          if (values[i] && values[i][0] === 'それ以下') {
            percentageEndRow = i;
            break;
          }
        }

        // キーワードセクションのヘッダー行を探す
        let keywordHeaderRow = -1;
        for (let i = percentageEndRow + 1; i < values.length; i++) {
          if (values[i] && values[i][0] === 'キーワード') {
            keywordHeaderRow = i;
            break;
          }
        }

        // 日付列を統一的に管理（C列から開始）
        let dateColumnIndex = -1;
        
        // キーワードヘッダー行から日付列を確認
        if (keywordHeaderRow >= 0 && values[keywordHeaderRow]) {
          const headerRow = values[keywordHeaderRow];
          dateColumnIndex = headerRow.indexOf(today);
          
          // 新しい日付の場合は列を追加
          if (dateColumnIndex === -1) {
            // C列（インデックス2）に新しい日付を挿入
            dateColumnIndex = 2;
            
            // すべての行に新しい列を挿入
            for (let i = 0; i < values.length; i++) {
              if (values[i] && values[i].length >= 2) {
                // キーワードヘッダー行には日付を挿入
                if (i === keywordHeaderRow) {
                  values[i].splice(dateColumnIndex, 0, today);
                } else if (i === 0 && values[i][0] === '割合') {
                  // 割合ヘッダー行にも日付を挿入
                  values[i].splice(dateColumnIndex, 0, today);
                } else {
                  // その他の行は空のセルを挿入
                  values[i].splice(dateColumnIndex, 0, '');
                }
              }
            }
          }
        } else if (values[0] && values[0][0] === '割合') {
          // キーワードセクションがまだない場合、割合セクションから確認
          dateColumnIndex = values[0].indexOf(today);
          if (dateColumnIndex === -1) {
            dateColumnIndex = 2;
            // 割合セクションの行に新しい列を挿入
            for (let i = 0; i <= percentageEndRow; i++) {
              if (values[i] && values[i].length >= 2) {
                values[i].splice(dateColumnIndex, 0, i === 0 ? today : '');
              }
            }
          }
        }

        // 割合データの更新
        if (percentageEndRow >= 0 && dateColumnIndex >= 0) {
          const rankCounts = this.getRankCounts(data);
          const percentValues = [
            `${analysis.rankPercent['1-3'].toFixed(2)} (${rankCounts['1-3']}件)`,
            `${analysis.rankPercent['4-10'].toFixed(2)} (${rankCounts['4-10']}件)`,
            `${analysis.rankPercent['11-50'].toFixed(2)} (${rankCounts['11-50']}件)`,
            `${analysis.rankPercent.others.toFixed(2)} (${rankCounts.others}件)`
          ];

          for (let i = 0; i < percentValues.length; i++) {
            const rowIndex = i + 1; // 割合ヘッダーの次の行から
            if (values[rowIndex]) {
              // 配列を必要なサイズまで拡張
              while (values[rowIndex].length <= dateColumnIndex) {
                values[rowIndex].push('');
              }
              values[rowIndex][dateColumnIndex] = percentValues[i];
            }
          }
        }

        // キーワードデータの更新
        if (keywordHeaderRow >= 0 && dateColumnIndex >= 0) {
          // キーワードデータを配置
          const keywordStartRow = keywordHeaderRow + 1;
          const existingKeywords = new Map<string, number>();
          
          // 既存のキーワードをマップに登録
          for (let i = keywordStartRow; i < values.length; i++) {
            if (values[i] && values[i][0]) {
              existingKeywords.set(values[i][0], i);
            }
          }

          // データを更新または追加
          for (const item of data) {
            const existingRowIndex = existingKeywords.get(item.keyword);
            
            if (existingRowIndex !== undefined) {
              // 既存の行を更新
              while (values[existingRowIndex].length <= dateColumnIndex) {
                values[existingRowIndex].push('');
              }
              values[existingRowIndex][dateColumnIndex] = item.rank.toString();
              
              // URLを更新
              if (item.rankingUrl) {
                values[existingRowIndex][1] = item.rankingUrl;
              }
            } else {
              // 新しい行を追加
              const newRow: string[] = [item.keyword, item.rankingUrl || ''];
              while (newRow.length < dateColumnIndex) {
                newRow.push('');
              }
              newRow[dateColumnIndex] = item.rank.toString();
              values.push(newRow);
            }
          }
        } else if (keywordHeaderRow === -1 && data.length > 0) {
          // キーワードセクションがまだない場合は追加
          values.push([]); // 空行
          const headerRow = ['キーワード', 'URL'];
          while (headerRow.length < dateColumnIndex) {
            headerRow.push('');
          }
          headerRow[dateColumnIndex] = today;
          values.push(headerRow);
          
          // キーワードデータを追加
          for (const item of data) {
            const newRow: string[] = [item.keyword, item.rankingUrl || ''];
            while (newRow.length < dateColumnIndex) {
              newRow.push('');
            }
            newRow[dateColumnIndex] = item.rank.toString();
            values.push(newRow);
          }
        }
      }
      
      // レート制限対策の遅延
      await this.delay(this.rateLimitDelay);
      
      // スプレッドシート全体を更新
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: values
        }
      });
      
      console.log(`✅ 統合データを「${sheetName}」シートに書き込みました`);
    } catch (error) {
      console.error('❌ 統合データの書き込みエラー:', error);
      throw error;
    }
  }
}