#!/bin/bash

# Cloud Run Job セットアップスクリプト
# このスクリプトは、Nobilist Rank CheckerをCloud Run Jobとしてデプロイするための自動化スクリプトです

set -e

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# プロジェクト設定
echo -e "${GREEN}=== Cloud Run Job セットアップ開始 ===${NC}"

# プロジェクトIDの入力
read -p "Google Cloud プロジェクトID: " PROJECT_ID
export PROJECT_ID
export REGION="asia-northeast1"
export JOB_NAME="nobilist-rank-check-job"
export REPOSITORY_NAME="nobilist-repo"

# プロジェクトの設定
echo -e "${YELLOW}プロジェクトを設定中...${NC}"
gcloud config set project ${PROJECT_ID}

# APIの有効化
echo -e "${YELLOW}必要なAPIを有効化中...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# シークレット作成関数
create_secret() {
    local secret_name=$1
    local secret_prompt=$2
    local is_file=$3
    
    # シークレットが既に存在するかチェック
    if gcloud secrets describe ${secret_name} &>/dev/null; then
        echo -e "${YELLOW}シークレット '${secret_name}' は既に存在します。スキップします。${NC}"
        return
    fi
    
    if [ "${is_file}" = "true" ]; then
        read -p "${secret_prompt}" file_path
        if [ -f "${file_path}" ]; then
            gcloud secrets create ${secret_name} --data-file="${file_path}"
            echo -e "${GREEN}シークレット '${secret_name}' を作成しました。${NC}"
        else
            echo -e "${RED}ファイルが見つかりません: ${file_path}${NC}"
            exit 1
        fi
    else
        read -s -p "${secret_prompt}" secret_value
        echo
        echo -n "${secret_value}" | gcloud secrets create ${secret_name} --data-file=-
        echo -e "${GREEN}シークレット '${secret_name}' を作成しました。${NC}"
    fi
}

# シークレットの作成
echo -e "${YELLOW}シークレットを作成中...${NC}"
create_secret "nobilist-email" "Nobilistのメールアドレス: " false
create_secret "nobilist-password" "Nobilistのパスワード: " false
create_secret "spreadsheet-id" "Google SpreadsheetのID: " false
create_secret "slack-webhook-url" "Slack Webhook URL (オプション、スキップする場合はEnter): " false
create_secret "google-credentials" "Google認証情報JSONファイルのパス: " true

# サービスアカウントの権限設定
echo -e "${YELLOW}サービスアカウントの権限を設定中...${NC}"
SERVICE_ACCOUNT=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")-compute@developer.gserviceaccount.com

for secret in nobilist-email nobilist-password spreadsheet-id slack-webhook-url google-credentials; do
    if gcloud secrets describe ${secret} &>/dev/null; then
        gcloud secrets add-iam-policy-binding ${secret} \
            --member="serviceAccount:${SERVICE_ACCOUNT}" \
            --role="roles/secretmanager.secretAccessor" \
            --quiet
    fi
done

# Artifact Registryの設定
echo -e "${YELLOW}Artifact Registryを設定中...${NC}"
if ! gcloud artifacts repositories describe ${REPOSITORY_NAME} --location=${REGION} &>/dev/null; then
    gcloud artifacts repositories create ${REPOSITORY_NAME} \
        --repository-format=docker \
        --location=${REGION} \
        --description="Nobilist rank checker Docker images"
else
    echo -e "${YELLOW}リポジトリ '${REPOSITORY_NAME}' は既に存在します。${NC}"
fi

# Docker認証設定
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Cloud Buildでのデプロイ
echo -e "${YELLOW}Cloud Run Jobをデプロイ中...${NC}"
gcloud builds submit --config=cloudbuild-job.yaml

# スケジューラー用サービスアカウントの作成
echo -e "${YELLOW}スケジューラー用サービスアカウントを作成中...${NC}"
SCHEDULER_SA="nobilist-job-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe ${SCHEDULER_SA} &>/dev/null; then
    gcloud iam service-accounts create nobilist-job-scheduler \
        --display-name="Nobilist Job Scheduler Service Account"
fi

# Cloud Run Job実行権限を付与
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SCHEDULER_SA}" \
    --role="roles/run.invoker" \
    --quiet

# Cloud Schedulerジョブの作成
echo -e "${YELLOW}Cloud Schedulerジョブを作成中...${NC}"
read -p "実行時刻 (cron形式、デフォルト: 0 9 * * *): " SCHEDULE
SCHEDULE=${SCHEDULE:-"0 9 * * *"}

if gcloud scheduler jobs describe nobilist-daily-job --location=${REGION} &>/dev/null; then
    echo -e "${YELLOW}スケジューラージョブを更新中...${NC}"
    gcloud scheduler jobs update http nobilist-daily-job \
        --location=${REGION} \
        --schedule="${SCHEDULE}"
else
    echo -e "${YELLOW}スケジューラージョブを作成中...${NC}"
    gcloud scheduler jobs create http nobilist-daily-job \
        --location=${REGION} \
        --schedule="${SCHEDULE}" \
        --time-zone="Asia/Tokyo" \
        --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
        --http-method=POST \
        --oauth-service-account-email="${SCHEDULER_SA}"
fi

# テスト実行の確認
echo -e "${GREEN}=== セットアップ完了 ===${NC}"
echo
read -p "テスト実行を行いますか？ (y/n): " RUN_TEST

if [ "${RUN_TEST}" = "y" ] || [ "${RUN_TEST}" = "Y" ]; then
    echo -e "${YELLOW}Cloud Run Jobを実行中...${NC}"
    gcloud run jobs execute ${JOB_NAME} --region=${REGION}
    
    echo -e "${YELLOW}実行状態を確認中...${NC}"
    sleep 5
    gcloud run jobs executions list --job=${JOB_NAME} --region=${REGION} --limit=1
fi

echo
echo -e "${GREEN}セットアップが完了しました！${NC}"
echo
echo "次のコマンドで状態を確認できます:"
echo "  実行履歴: gcloud run jobs executions list --job=${JOB_NAME} --region=${REGION}"
echo "  ログ確認: gcloud logging read 'resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"${JOB_NAME}\"' --limit 50"
echo "  手動実行: gcloud run jobs execute ${JOB_NAME} --region=${REGION}"