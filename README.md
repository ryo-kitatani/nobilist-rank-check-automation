# Nobilist Rank Check Automation

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

TypeScript-based automation tool for automatically downloading ranking reports from **Nobilist** (Japanese SEO ranking tool), processing CSV data, and syncing to Google Sheets in matrix format with Slack notifications.

## 🚀 Features

- **🔐 Automated Login**: Uses Playwright to automatically log into Nobilist platform with stored credentials
- **📊 CSV Report Download**: Automatically navigates to specific website reports and downloads ranking data as CSV files
- **📈 Matrix Format Google Sheets**: Updates Google Sheets in matrix format (keywords × dates) with automatic keyword row creation
- **🔗 URL Tracking**: Automatically tracks ranking URLs in spreadsheet with multi-URL support
- **📱 Slack Notifications**: Sends detailed ranking analysis to Slack with statistics and insights
- **📁 File Management**: Saves downloaded files with date-stamped filenames in a dedicated downloads folder
- **🔄 Automated Process**: Complete end-to-end automation from login to Slack notification

## 🛠️ Technology Stack

- **TypeScript/Node.js** - Core runtime and language
- **Playwright** - Browser automation for web scraping
- **Google Sheets API** - For spreadsheet data synchronization
- **Slack Web API** - For automated notifications
- **dotenv** - Environment variable management
- **csv-parser** - CSV file processing

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
   SLACK_WEBHOOK_URL=your-slack-webhook-url
   NODE_ENV=development
   ```

5. **Set up Google Sheets API**
   - Create a Google Cloud project and enable the Google Sheets API
   - Create a service account and download the credentials JSON file
   - Rename the file to `google_credentials_for_app.json` and place it in the root directory
   - Share your Google Spreadsheet with the service account email

6. **Set up Slack Integration (Optional)**
   - Create a Slack webhook URL in your workspace
   - Add the webhook URL to your `.env` file

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
📍 ブラウザ初期化中...
📍 ログイン中...
✅ ログイン成功！
📍 CSVダウンロード開始...
✅ CSVダウンロード成功: ./downloads/nobilist_ranks_2025-06-14.csv
✅ 273件のデータをマトリックス形式で更新しました
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

## 🔮 Future Enhancements

The following features are planned for future development:

- **⏰ Scheduled Runs**: Set up cron jobs for automated daily/weekly runs
- **🔧 Multiple Sites**: Support for multiple website reports
- **📈 Advanced Analytics**: More detailed data analysis and trend reporting
- **🚨 Alert System**: Automated alerts for significant ranking changes
- **📊 Dashboard**: Web-based dashboard for monitoring rankings

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## ⚠️ Important Notes

- This tool is specifically designed for Nobilist platform
- Currently configured for "coeteco.jp" reports
- Requires valid Nobilist account credentials and Google Sheets API access
- Downloads are saved locally in the `downloads/` directory
- Browser runs in headless mode in production environment
- Google Sheets data is updated in matrix format (keywords as rows, dates as columns)
- Slack notifications include detailed ranking analysis and statistics
- The `rank_history/` directory stores local keyword history (optional, can be disabled)

## 📞 Support

If you encounter any issues or have questions, please:

1. Check the existing issues
2. Create a new issue with detailed description
3. Include error messages and environment details

---

**Built with ❤️ for SEO professionals and digital marketers**
