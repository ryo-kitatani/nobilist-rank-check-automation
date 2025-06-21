# Cloud Run Job デプロイメント手順

## 前提条件
- Google Cloud プロジェクトが作成済み
- gcloud CLI がインストール済み
- プロジェクトに請求先アカウントが設定済み

## 1. 環境変数の設定

Cloud Run Jobで使用する環境変数を設定します：

```bash
# プロジェクトIDを設定
export PROJECT_ID="your-project-id"
export REGION="asia-northeast1"  # 東京リージョン
export JOB_NAME="nobilist-rank-check-job"
```

## 2. Google Cloud APIの有効化

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable artifactregistry.googleapis.com
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
gcloud secrets create google-credentials --data-file=google_credentials_for_app.json
```

## 4. サービスアカウントの権限設定

Cloud Run Jobがシークレットにアクセスできるよう権限を設定：

```bash
# Cloud Run サービスアカウントを取得
SERVICE_ACCOUNT=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")-compute@developer.gserviceaccount.com

# シークレットへのアクセス権限を付与
for secret in nobilist-email nobilist-password spreadsheet-id slack-webhook-url google-credentials; do
  gcloud secrets add-iam-policy-binding ${secret} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"
done
```

## 5. Artifact Registryの設定

```bash
# Artifact Registryにリポジトリを作成
gcloud artifacts repositories create nobilist-repo \
    --repository-format=docker \
    --location=${REGION} \
    --description="Nobilist rank checker Docker images"

# Docker認証設定
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

## 6. Cloud Run Jobのデプロイ

### オプション1: Cloud Buildを使用（推奨）

```bash
# Cloud Buildを使用してビルドとデプロイ
gcloud builds submit --config=cloudbuild-job.yaml
```

### オプション2: 手動でのビルドとデプロイ

```bash
# Dockerイメージをビルド
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/nobilist-repo/${JOB_NAME}:latest .

# イメージをプッシュ
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/nobilist-repo/${JOB_NAME}:latest

# Cloud Run Jobをデプロイ
gcloud run jobs deploy ${JOB_NAME} \
    --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/nobilist-repo/${JOB_NAME}:latest \
    --region ${REGION} \
    --memory 2Gi \
    --task-timeout 600 \
    --max-retries 1 \
    --parallelism 1 \
    --set-env-vars="NODE_ENV=production" \
    --set-secrets="NOBILIST_EMAIL=nobilist-email:latest,NOBILIST_PASSWORD=nobilist-password:latest,SPREADSHEET_ID=spreadsheet-id:latest,SLACK_WEBHOOK_URL=slack-webhook-url:latest" \
    --update-secrets="GOOGLE_CREDENTIALS_PATH=/secrets/google-credentials:google-credentials:latest"
```

## 7. Cloud Schedulerの設定

毎日定時実行するためのスケジューラーを設定：

```bash
# サービスアカウントの作成
gcloud iam service-accounts create nobilist-job-scheduler \
    --display-name="Nobilist Job Scheduler Service Account"

# Cloud Run Job実行権限を付与
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:nobilist-job-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/run.invoker"

# スケジューラージョブの作成（毎日午前9時に実行）
gcloud scheduler jobs create http nobilist-daily-job \
    --location=${REGION} \
    --schedule="0 9 * * *" \
    --time-zone="Asia/Tokyo" \
    --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
    --http-method=POST \
    --oauth-service-account-email="nobilist-job-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"
```

## 8. 手動実行テスト

```bash
# Cloud Run Jobを手動実行
gcloud run jobs execute ${JOB_NAME} --region=${REGION}

# 実行状態の確認
gcloud run jobs executions list --job=${JOB_NAME} --region=${REGION}

# 最新の実行ログを確認
EXECUTION_NAME=$(gcloud run jobs executions list --job=${JOB_NAME} --region=${REGION} --limit=1 --format="value(name)")
gcloud run jobs executions describe ${EXECUTION_NAME} --region=${REGION}

# ログの確認
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=${JOB_NAME}" \
    --limit 50 \
    --format json
```

## 9. 監視とアラート設定

```bash
# Cloud Monitoringでアラートポリシーを作成
gcloud alpha monitoring policies create \
    --notification-channels=YOUR_CHANNEL_ID \
    --display-name="Nobilist Job Failure Alert" \
    --condition-display-name="Job Execution Failed" \
    --condition-expression='resource.type = "cloud_run_job" AND 
                           resource.labels.job_name = "'${JOB_NAME}'" AND 
                           metric.type = "run.googleapis.com/job/completed_execution_count" AND 
                           metric.labels.result = "failed"' \
    --duration=60s \
    --threshold-value=1 \
    --comparison=COMPARISON_GT
```

## トラブルシューティング

### メモリ不足エラーの場合
```bash
# メモリを増やす
gcloud run jobs update ${JOB_NAME} \
    --memory 4Gi \
    --region ${REGION}
```

### タイムアウトエラーの場合
```bash
# タイムアウトを延長（最大3600秒）
gcloud run jobs update ${JOB_NAME} \
    --task-timeout 1800 \
    --region ${REGION}
```

### Playwrightエラーの場合
Dockerfileの環境変数が正しく設定されているか確認してください。

### シークレットアクセスエラーの場合
```bash
# サービスアカウントの権限を確認
gcloud projects get-iam-policy ${PROJECT_ID} \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:*compute@developer.gserviceaccount.com"
```

## クリーンアップ

不要になった場合のリソース削除：

```bash
# Cloud Schedulerジョブの削除
gcloud scheduler jobs delete nobilist-daily-job --location=${REGION}

# Cloud Run Jobの削除
gcloud run jobs delete ${JOB_NAME} --region=${REGION}

# シークレットの削除
for secret in nobilist-email nobilist-password spreadsheet-id slack-webhook-url google-credentials; do
  gcloud secrets delete ${secret} --quiet
done

# サービスアカウントの削除
gcloud iam service-accounts delete nobilist-job-scheduler@${PROJECT_ID}.iam.gserviceaccount.com --quiet
```