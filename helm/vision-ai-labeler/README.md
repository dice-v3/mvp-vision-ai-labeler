# Vision AI Labeler Helm Chart

내부망 쿠버네티스에 Vision AI Labeler를 배포하기 위한 Helm 차트입니다.

## 사전 요구사항

- Kubernetes 1.19+
- Helm 3.0+
- 외부 서비스들이 이미 배포되어 있어야 함:
  - PostgreSQL (Platform DB, User DB, Labeler DB)
  - Redis
  - S3 호환 스토리지 (MinIO 등)

## 설치 방법

### 1. Docker 이미지 빌드 및 내부 레지스트리 푸시

```bash
# Backend 이미지 빌드
cd backend
docker build -t your-registry/vision-ai-labeler-backend:latest .
docker push your-registry/vision-ai-labeler-backend:latest

# Frontend 이미지 빌드 (API URL 설정 필요)
cd frontend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://labeler-api.internal.example.com \
  -t your-registry/vision-ai-labeler-frontend:latest .
docker push your-registry/vision-ai-labeler-frontend:latest
```

### 2. values.yaml 설정

`values.yaml` 파일을 복사하여 환경에 맞게 수정합니다:

```bash
cp helm/vision-ai-labeler/values.yaml helm/vision-ai-labeler/values-production.yaml
```

주요 설정 항목:
- `global.imageRegistry`: 내부 레지스트리 주소
- `platformDatabase`, `userDatabase`, `labelerDatabase`: 데이터베이스 연결 정보
- `redis`: Redis 연결 정보
- `storage`: S3/MinIO 연결 정보
- `secrets`: 비밀번호 및 인증 키

### 3. Helm 차트 설치

```bash
# 네임스페이스 생성 (필요시)
kubectl create namespace vision-ai-labeler

# Helm 차트 설치
helm install vision-ai-labeler ./helm/vision-ai-labeler \
  --namespace vision-ai-labeler \
  -f helm/vision-ai-labeler/values-production.yaml
```

### 4. 업그레이드

```bash
helm upgrade vision-ai-labeler ./helm/vision-ai-labeler \
  --namespace vision-ai-labeler \
  -f helm/vision-ai-labeler/values-production.yaml
```

### 5. 삭제

```bash
helm uninstall vision-ai-labeler --namespace vision-ai-labeler
```

## 설정 예시

### 외부 서비스 연결 (values-production.yaml)

```yaml
global:
  imageRegistry: "harbor.internal.company.com"
  imagePullSecrets:
    - name: harbor-registry-secret

backend:
  image:
    repository: vision-ai/labeler-backend
    tag: "v0.1.0"

frontend:
  image:
    repository: vision-ai/labeler-frontend
    tag: "v0.1.0"

# 이미 배포된 PostgreSQL 서비스 연결
platformDatabase:
  host: "platform-postgres.database.svc.cluster.local"
  port: 5432
  name: "platform"
  user: "labeler_readonly"

userDatabase:
  host: "user-postgres.database.svc.cluster.local"
  port: 5432
  name: "users"
  user: "admin"

labelerDatabase:
  host: "labeler-postgres.database.svc.cluster.local"
  port: 5432
  name: "labeler"
  user: "labeler_user"

# 이미 배포된 Redis 서비스 연결
redis:
  host: "redis-master.cache.svc.cluster.local"
  port: 6379
  db: 0

# 이미 배포된 MinIO 서비스 연결
storage:
  endpoint: "http://minio.storage.svc.cluster.local:9000"
  region: "us-east-1"
  useSSL: false
  bucketDatasets: "training-datasets"
  bucketAnnotations: "annotations"

# 비밀 정보 (실제 값으로 교체)
secrets:
  platformDbPassword: "실제_비밀번호"
  userDbPassword: "실제_비밀번호"
  labelerDbPassword: "실제_비밀번호"
  redisPassword: ""
  s3AccessKey: "minio_access_key"
  s3SecretKey: "minio_secret_key"
  jwtSecretKey: "production-jwt-secret-key"
  serviceJwtSecret: "match-platform-service-jwt-secret"

# Ingress 설정
ingress:
  enabled: true
  className: "nginx"
  backend:
    host: "labeler-api.internal.company.com"
  frontend:
    host: "labeler.internal.company.com"
```

### 기존 Secret 사용

이미 Kubernetes Secret이 있다면:

```yaml
secrets:
  existingSecret: "my-existing-secret"
```

Secret에는 다음 키들이 포함되어야 합니다:
- `PLATFORM_DB_PASSWORD`
- `USER_DB_PASSWORD`
- `LABELER_DB_PASSWORD`
- `REDIS_PASSWORD`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `JWT_SECRET_KEY`
- `SERVICE_JWT_SECRET`

## 트러블슈팅

### Pod 상태 확인
```bash
kubectl get pods -n vision-ai-labeler
kubectl describe pod <pod-name> -n vision-ai-labeler
kubectl logs <pod-name> -n vision-ai-labeler
```

### 데이터베이스 연결 테스트
```bash
kubectl exec -it <backend-pod> -n vision-ai-labeler -- python -c "
from app.core.database import get_labeler_db
db = next(get_labeler_db())
print('Database connection successful')
"
```

### Health Check
```bash
kubectl port-forward svc/vision-ai-labeler-backend 8001:8001 -n vision-ai-labeler
curl http://localhost:8001/health
curl http://localhost:8001/health/db
```

## 차트 구조

```
helm/vision-ai-labeler/
├── Chart.yaml              # 차트 메타데이터
├── values.yaml             # 기본 설정값
├── README.md               # 이 문서
├── .helmignore             # Helm 패키징 제외 패턴
└── templates/
    ├── _helpers.tpl        # 템플릿 헬퍼 함수
    ├── serviceaccount.yaml # ServiceAccount
    ├── configmap.yaml      # 환경 변수 ConfigMap
    ├── secret.yaml         # 비밀 정보 Secret
    ├── backend-deployment.yaml
    ├── backend-service.yaml
    ├── frontend-deployment.yaml
    ├── frontend-service.yaml
    ├── ingress.yaml        # Ingress (선택적)
    ├── migration-job.yaml  # DB 마이그레이션 Job
    └── NOTES.txt           # 설치 후 안내 메시지
```
