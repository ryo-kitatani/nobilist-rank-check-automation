# Nobilist Rank Check Automation

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

A comprehensive TypeScript automation tool for **Nobilist** (Japanese SEO ranking tool) that downloads ranking reports, processes CSV data, syncs to Google Sheets in matrix format, and sends intelligent Slack notifications with ranking analysis.

## 🚀 Features

- **🔐 Automated Login**: Uses Playwright to automatically log into Nobilist platform with stored credentials
- **📊 Intelligent CSV Processing**: Downloads and parses ranking reports with comprehensive data validation
- **📈 Matrix Format Sync**: Updates Google Sheets in matrix format (keywords × dates) with automatic row/column management
- **🔗 Multi-URL Tracking**: Tracks ranking URLs in spreadsheet with line-break separation for multiple URLs
- **📱 Smart Notifications**: Sends detailed Slack reports with ranking distribution, trend analysis, and performance insights
- **📁 Organized File Management**: Structured project with src/ directory and automated file handling
- **🔄 End-to-End Automation**: Complete workflow from browser automation to data analysis and notifications

## 🛠️ Technology Stack

- **TypeScript/Node.js** - Core runtime and language
- **Playwright** - Browser automation for web scraping
- **Google Sheets API v4** - Matrix-format spreadsheet synchronization with service account authentication
- **Slack Webhook API** - Rich notification system with threading and analysis
- **CSV-Parse** - Robust CSV data processing and validation
- **Axios** - HTTP client for API communications

## 📁 Project Structure

```
nobilist-rank-check-automation/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── nobilist.ts                 # Core Nobilist client class
│   ├── rankCheckService.ts         # Main orchestration service
│   ├── googleSheetsManager.ts      # Google Sheets integration
│   ├── slackNotifier.ts           # Slack notifications
│   ├── rankDataManager.ts         # CSV data processing
│   └── types/
│       └── index.ts               # TypeScript type definitions
├── downloads/                 # CSV reports storage
│   └── nobilist_ranks_YYYY-MM-DD.csv
├── dist/                      # Compiled JavaScript files
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── .env                       # Environment variables
├── google_credentials_for_app.json # Google Service Account credentials
└── README.md                  # This file
```

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nobilist-rank-check-automation
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browsers**
   ```bash
   npx playwright install
   ```

4. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   NOBILIST_EMAIL=your-email@example.com
   NOBILIST_PASSWORD=your-password
   GOOGLE_SPREADSHEET_ID=your-google-spreadsheet-id
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
   NODE_ENV=development
   ```

5. **Set up Google Sheets API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the **Google Sheets API**
   - Create a **Service Account** and generate a JSON key
   - Download and rename the key file to `google_credentials_for_app.json`
   - Place the file in the project root directory
   - Create a Google Spreadsheet and share it with the service account email (found in the JSON file)
   - Copy the spreadsheet ID from the URL and add it to your `.env` file

6. **Set up Slack Integration (Optional)**
   - Go to your Slack workspace settings
   - Create an **Incoming Webhook** integration
   - Copy the webhook URL to your `.env` file
   - The tool will send rich ranking reports with statistics and insights

## 🚀 Usage

### Basic Usage

```bash
# Run the automation
npm start

# Or for development
npm run dev
```

### What it does:

1. **Initialize Browser**: Launches Chromium browser with Playwright
2. **Login**: Automatically logs into Nobilist using provided credentials
3. **Navigate**: Goes to the specific report page (currently configured for "coeteco.jp")
4. **Download**: Clicks CSV download button and saves the file
5. **Process Data**: Parses CSV data and processes ranking information
6. **Update Google Sheets**: Syncs data to Google Sheets in matrix format (keywords × dates)
7. **Update URLs**: Tracks ranking URLs in the spreadsheet with multi-URL support
8. **Send Slack Notification**: Analyzes data and sends detailed report to Slack
9. **Cleanup**: Closes the browser and exits

### Expected Output:

```
📍 初期化中...
Nobilistにログイン中...♻️
ログイン成功
📍 データ解析中...
✅ 273件のデータを読み込みました

📍 Google Spreadsheetへの転記を試みています...
✅ Google Sheets APIを初期化しました
✅ 273件のデータをマトリックス形式で更新しました
✅ Google Spreadsheetへの転記完了！

📍 Slack通知を送信中...
✅ Slack通知を送信しました
📍 ブラウザ終了
```

## 🔄 Development

### Scripts

```bash
# Run the automation (build + start)
npm start

# Run in development mode
npm run dev

# Build TypeScript
npm run build
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NOBILIST_EMAIL` | Nobilist account email | Yes |
| `NOBILIST_PASSWORD` | Nobilist account password | Yes |
| `GOOGLE_SPREADSHEET_ID` | Google Sheets spreadsheet ID | Yes |
| `SLACK_WEBHOOK_URL` | Slack webhook URL for notifications | Optional |
| `NODE_ENV` | Environment (development/production) | No |

## 📊 Slack Notification Features

The tool sends comprehensive ranking reports to Slack including:

- **📈 Ranking Distribution**: Percentage breakdown of rankings (1-3位, 4-10位, 11-50位, etc.)
- **📊 Trend Analysis**: Daily ranking changes with improvement/decline statistics
- **🏆 Top Performers**: Keywords with significant ranking improvements (3+ positions)
- **⚠️ Alert Keywords**: Keywords with significant ranking drops (3+ positions)
- **📋 Summary Stats**: Total keywords tracked, change percentages, and date tracking

## 🔮 Future Enhancements

- **⏰ Scheduled Runs**: Set up cron jobs for automated daily/weekly runs
- **🔧 Multiple Sites**: Support for multiple website reports
- **📈 Historical Trends**: Long-term ranking trend analysis and visualization
- **🚨 Smart Alerts**: Customizable alerts for ranking threshold changes
- **📊 Web Dashboard**: Real-time ranking monitoring interface

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## ⚠️ Important Notes

- **Platform**: Specifically designed for Nobilist platform (nobilista.com)
- **Target Site**: Currently configured for "coeteco.jp" reports (customizable)
- **Authentication**: Requires valid Nobilist credentials and Google Sheets service account
- **File Storage**: Downloads saved in `downloads/` directory with date-stamped filenames
- **Browser Mode**: Runs headless in production, visible in development
- **Data Format**: Google Sheets uses matrix format (keywords as rows, dates as columns)
- **URL Tracking**: Multi-URL support with line-break separation in spreadsheet
- **Notifications**: Rich Slack reports with ranking analysis, trends, and statistics
- **Project Structure**: Clean organization with all source code in `src/` directory

## 📞 Support

If you encounter any issues or have questions, please:

1. Check the existing issues
2. Create a new issue with detailed description
3. Include error messages and environment details

---

**Built with ❤️ for SEO professionals and digital marketers**
