# GitHub Actions CI/CD Setup

## Required Secrets

Vào **Settings → Secrets and variables → Actions** trong GitHub repo và thêm 2 secrets:

### 1. `FIREBASE_SERVICE_ACCOUNT_KEOLAI_63EC1`

Lấy từ GCP Console:

```bash
# Tạo service account key (chỉ làm 1 lần)
gcloud iam service-accounts keys create firebase-ci-key.json \
  --iam-account=github-actions-deploy@keolai-63ec1.iam.gserviceaccount.com \
  --project=keolai-63ec1

# Copy nội dung file JSON → paste vào secret
cat firebase-ci-key.json
```

> Nếu chưa có service account:
> ```bash
> gcloud iam service-accounts create github-actions-deploy \
>   --display-name="GitHub Actions Deploy" --project=keolai-63ec1
> gcloud projects add-iam-policy-binding keolai-63ec1 \
>   --member="serviceAccount:github-actions-deploy@keolai-63ec1.iam.gserviceaccount.com" \
>   --role=roles/firebase.admin
> ```

### 2. `FIREBASE_CI_TOKEN`

Dùng để deploy Functions (vì `action-hosting-deploy` chỉ deploy Hosting):

```bash
# Chạy lệnh này local, paste token vào secret
firebase login:ci
```

## Workflow Flow

```
Push to main
    → Build Next.js (static export)
    → Install Functions dependencies  
    → Deploy Hosting via action-hosting-deploy
    → Deploy Functions via firebase-tools
```

## Manual Trigger

Có thể trigger thủ công từ GitHub Actions tab → "Deploy KeoLai to Firebase" → "Run workflow".
