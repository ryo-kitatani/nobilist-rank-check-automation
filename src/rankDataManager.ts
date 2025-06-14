import * as fs from 'fs/promises';
import * as csv from 'csv-parse/sync';
import { RankData } from './types';

export default class RankDataManager {

  private parseCSV(csvContent: string): RankData[] {
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      bom: true
    });

    return records.map((record: any, index: number) => {
      try {
        if (!record['日時']) {
          console.error(`警告: レコード${index + 1}に日時が含まれていません`, record);
          return null;
        }
        
        const [date, time] = record['日時'].split(' ');
        return {
          date,
          time,
          keyword: record['キーワード'] || '',
          rank: parseInt(record['順位']) || 0,
          previousDayChange: parseInt(record['前日比']) || 0,
          searchResults: record['検索結果'] || '',
          searchVolume: parseInt(record['検索ボリューム']) || 0,
          estimatedAccess: parseInt(record['想定アクセス']) || 0,
          searchFeatures: record['検索結果の特徴'] || '',
          competitiveness: parseInt(record['競合性']) || 0,
          group: record['グループ'] || '',
          priorityUrl: record['優先URL'] || '',
          title: record['タイトル'] || '',
          rankingUrl: record['ランクインしているURL'] || '',
          memo: record['メモ'] || '',
          country: record['国'] || ''
        };
      } catch (error) {
        console.error(`レコード${index + 1}のパースエラー:`, error, record);
        return null;
      }
    }).filter((record: RankData | null): record is RankData => record !== null);
  }

  async parseCSVFile(csvPath: string): Promise<RankData[]> {
    try {
      const csvContent = await fs.readFile(csvPath, 'utf-8');
      const rankData = this.parseCSV(csvContent);
      console.log(`✅ ${rankData.length}件のデータを読み込みました`);
      return rankData;
    } catch (error) {
      console.error('❌ CSVデータの読み込みに失敗しました:', error);
      throw error;
    }
  }

}