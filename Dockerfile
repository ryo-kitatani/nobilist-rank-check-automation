# Node.js 20のAlpine Linuxベースイメージを使用（軽量で高速）
FROM node:20-alpine

# Chromiumと日本語フォントのインストール
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-cjk

# Puppeteerが使用するChromiumのパスを環境変数に設定
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 作業ディレクトリの設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係のインストール
RUN npm ci --only=production

# TypeScriptのビルドに必要な開発依存関係をインストール
RUN npm install --save-dev typescript @types/node

# ソースコードをコピー
COPY . .

# TypeScriptをビルド
RUN npm run build

# ビルド後に開発依存関係を削除（イメージサイズ削減）
RUN npm prune --production

# 非rootユーザーで実行（セキュリティ向上）
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# downloadsディレクトリの作成と権限設定
RUN mkdir -p downloads && \
    chown -R nodejs:nodejs /app

USER nodejs

# Cloud Runはポート8080を使用
EXPOSE 8080

# アプリケーションの起動
CMD ["node", "dist/index.js"]