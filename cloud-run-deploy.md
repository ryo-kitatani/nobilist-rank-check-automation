# Cloud Run デプロイメント手順

## 前提条件
- Google Cloud プロジェクトが作成済み
- gcloud CLI がインストール済み
- プロジェクトに請求先アカウントが設定済み

## 1. 環境変数の設定

Cloud Runで使用する環境変数を設定します：

```bash
# プロジェクトIDを設定
export PROJECT_ID="your-project-id"
export REGION="asia-northeast1"  # 東京リージョン
export SERVICE_NAME="nobilist-rank-checker"
```

## 2. Google Cloud APIの有効化

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

## 3. シークレットの作成

環境変数を安全に管理するためSecret Managerを使用：

```bash
# Nobilistの認証情報
echo -n "your-nobilist-email" | gcloud secrets create nobilist-email --data-file=-
echo -n "your-nobilist-password" | gcloud secrets create nobilist-password --data-file=-

# Google Sheets関連
echo -n "your-spreadsheet-id" | gcloud secrets create spreadsheet-id --data-file=-

# Slack Webhook URL（オプション）
echo -n "your-slack-webhook-url" | gcloud secrets create slack-webhook-url --data-file=-

# Google認証情報JSONファイル
gcloud secrets create google-credentials --data-file=path/to/credentials.json
```

## 4. Dockerイメージのビルドとプッシュ

```bash
# Artifact Registryにリポジトリを作成
gcloud artifacts repositories create nobilist-repo \
    --repository-format=docker \
    --location=${REGION}

# Dockerイメージをビルド
gcloud builds submit --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/nobilist-repo/${SERVICE_NAME}
```

## 5. Cloud Runへのデプロイ

```bash
gcloud run deploy ${SERVICE_NAME} \
    --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/nobilist-repo/${SERVICE_NAME} \
    --platform managed \
    --region ${REGION} \
    --memory 2Gi \
    --timeout 600 \
    --max-instances 1 \
    --no-allow-unauthenticated \
    --set-env-vars="NODE_ENV=production" \
    --set-secrets="NOBILIST_EMAIL=nobilist-email:latest,NOBILIST_PASSWORD=nobilist-password:latest,SPREADSHEET_ID=spreadsheet-id:latest,SLACK_WEBHOOK_URL=slack-webhook-url:latest" \
    --update-secrets="GOOGLE_CREDENTIALS_PATH=/secrets/google-credentials:google-credentials:latest"
```

## 6. Cloud Schedulerの設定

毎日定時実行するためのスケジューラーを設定：

```bash
# サービスアカウントの作成
gcloud iam service-accounts create nobilist-scheduler \
    --display-name="Nobilist Scheduler Service Account"

# Cloud Run呼び出し権限を付与
gcloud run services add-iam-policy-binding ${SERVICE_NAME} \
    --member="serviceAccount:nobilist-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/run.invoker" \
    --region=${REGION}

# Cloud SchedulerジョブのURLを取得
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format="value(status.url)")

# スケジューラージョブの作成（毎日午前9時に実行）
gcloud scheduler jobs create http nobilist-daily-check \
    --location=${REGION} \
    --schedule="0 9 * * *" \
    --time-zone="Asia/Tokyo" \
    --uri="${SERVICE_URL}" \
    --http-method=POST \
    --oidc-service-account-email="nobilist-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
    --oidc-token-audience="${SERVICE_URL}"
```

## 7. 手動実行テスト

```bash
# スケジューラージョブを手動実行
gcloud scheduler jobs run nobilist-daily-check --location=${REGION}

# ログの確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE_NAME}" \
    --limit 50 \
    --format json
```

## トラブルシューティング

### メモリ不足エラーの場合
```bash
# メモリを増やす
gcloud run services update ${SERVICE_NAME} \
    --memory 4Gi \
    --region ${REGION}
```

### タイムアウトエラーの場合
```bash
# タイムアウトを延長（最大3600秒）
gcloud run services update ${SERVICE_NAME} \
    --timeout 900 \
    --region ${REGION}
```

### Puppeteerエラーの場合
Dockerfileの環境変数が正しく設定されているか確認してください。