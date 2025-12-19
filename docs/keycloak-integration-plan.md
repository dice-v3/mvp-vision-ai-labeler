# Keycloak 연동 계획서

## 1. 개요

### 1.1 목적
현재 자체 JWT 인증 시스템에서 Keycloak 기반 SSO(Single Sign-On) 인증으로 **완전 전환**하여:
- 중앙 집중식 사용자 관리
- 표준 OAuth2/OIDC 프로토콜 활용
- 향후 다른 서비스와의 SSO 연동 용이

### 1.2 마이그레이션 방식
**완전 마이그레이션** - 기존 인증 시스템을 완전히 제거하고 Keycloak으로 전환
- 기존 로그인 API 완전 제거
- 사용자 데이터는 Keycloak에서 관리
- 비밀번호 재설정 필요 (사용자 안내 필요)

### 1.3 현재 상태 → 목표 상태

| 항목 | 현재 (제거 예정) | 변경 후 |
|------|-----------------|---------|
| 인증 방식 | 자체 JWT (python-jose) | Keycloak OIDC |
| 사용자 DB | PostgreSQL (User DB, port 5433) | Keycloak 내장 DB |
| 비밀번호 | bcrypt 해시 (passlib) | Keycloak 관리 |
| 토큰 만료 | 24시간 | Keycloak 설정 따름 |
| 프론트엔드 | localStorage에 토큰 저장 | next-auth 세션 |
| 로그인 API | `POST /api/v1/auth/login` | 제거 (Keycloak 리다이렉트) |

---

## 2. 아키텍처 변경

### 2.1 현재 인증 플로우 (제거 예정)
```
[사용자] → [로그인 페이지] → [POST /api/v1/auth/login]
                                      ↓
                            [User DB 조회 + 비밀번호 검증]
                                      ↓
                            [자체 JWT 발급]
                                      ↓
                            [localStorage 저장]
                                      ↓
                            [API 요청 시 Bearer 토큰 전송]
```

### 2.2 Keycloak 연동 후 플로우
```
[사용자] → [앱 접근] → [미인증 시 Keycloak으로 리다이렉트]
                                      ↓
                            [Keycloak 로그인 페이지]
                                      ↓
                            [인증 성공 → Authorization Code 발급]
                                      ↓
                            [Frontend: Code → Token 교환 (next-auth)]
                                      ↓
                            [Access Token + Refresh Token 저장]
                                      ↓
                            [API 요청 시 Keycloak 토큰 검증]
```

---

## 3. 단계별 작업 목록

### Phase 1: 환경 설정 및 의존성 추가

#### 3.1.1 Backend 의존성 추가
**파일**: `backend/requirements.txt`

```txt
# Keycloak/OIDC 관련 (추가)
python-keycloak>=3.0.0    # Keycloak Admin API 클라이언트
authlib>=1.3.0            # OAuth2/OIDC 라이브러리
httpx>=0.26.0             # 비동기 HTTP 클라이언트 (이미 설치됨)

# 제거 대상 (더 이상 필요 없음)
# python-jose[cryptography]==3.3.0  → 제거
# passlib[bcrypt]==1.7.4            → 제거
# bcrypt==4.0.1                     → 제거
```

#### 3.1.2 Backend 환경 변수 추가
**파일**: `backend/.env.example`

```env
# Keycloak Configuration (추가)
KEYCLOAK_SERVER_URL=http://localhost:8080
KEYCLOAK_REALM=mvp-vision
KEYCLOAK_CLIENT_ID=labeler-backend
KEYCLOAK_CLIENT_SECRET=your-client-secret

# 제거 대상
# JWT_SECRET_KEY        → 제거
# JWT_ALGORITHM         → 제거
# JWT_EXPIRE_MINUTES    → 제거
```

#### 3.1.3 Frontend 의존성 추가
**파일**: `frontend/package.json`

```json
{
  "dependencies": {
    "next-auth": "^4.24.0"
  }
}
```

#### 3.1.4 Frontend 환경 변수 추가
**파일**: `frontend/.env.local`

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3010
NEXTAUTH_SECRET=your-nextauth-secret

# Keycloak
KEYCLOAK_CLIENT_ID=labeler-frontend
KEYCLOAK_CLIENT_SECRET=your-client-secret
KEYCLOAK_ISSUER=http://localhost:8080/realms/mvp-vision
```

---

### Phase 2: Backend Keycloak 연동

#### 3.2.1 Keycloak 설정 모듈 생성
**신규 파일**: `backend/app/core/keycloak.py`

```python
from authlib.integrations.starlette_client import OAuth
from functools import lru_cache
import httpx

class KeycloakAuth:
    def __init__(self, server_url: str, realm: str, client_id: str, client_secret: str):
        self.server_url = server_url
        self.realm = realm
        self.client_id = client_id
        self.client_secret = client_secret
        self.issuer = f"{server_url}/realms/{realm}"
        self._jwks_client = None

    async def verify_token(self, token: str) -> dict:
        """Keycloak Access Token 검증"""
        # 1. JWKS에서 공개키 조회 (캐싱)
        # 2. 토큰 서명 검증
        # 3. 만료 시간 확인
        # 4. 발급자(issuer) 확인
        # 5. Audience 확인
        pass

    def get_user_info_from_token(self, token_payload: dict) -> dict:
        """토큰에서 사용자 정보 추출"""
        return {
            "sub": token_payload.get("sub"),  # Keycloak User ID
            "email": token_payload.get("email"),
            "name": token_payload.get("name"),
            "roles": token_payload.get("realm_access", {}).get("roles", []),
        }
```

#### 3.2.2 인증 의존성 전면 수정
**파일**: `backend/app/core/security.py`

| 함수 | 변경 내용 |
|------|----------|
| `get_current_user()` | Keycloak 토큰 검증으로 완전 교체 |
| `decode_access_token()` | **삭제** |
| `verify_password()` | **삭제** |
| `get_password_hash()` | **삭제** |
| `create_access_token()` | **삭제** |

```python
# 변경 후 security.py
from app.core.keycloak import keycloak_auth

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Keycloak 토큰에서 사용자 정보 추출"""
    token = credentials.credentials
    try:
        payload = await keycloak_auth.verify_token(token)
        return keycloak_auth.get_user_info_from_token(payload)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
```

#### 3.2.3 인증 엔드포인트 정리
**파일**: `backend/app/api/v1/endpoints/auth.py`

| 엔드포인트 | 변경 |
|-----------|------|
| `POST /auth/login` | **삭제** |
| `GET /auth/me` | 유지 - Keycloak 토큰에서 사용자 정보 반환 |

```python
# 변경 후 auth.py - 최소화된 버전
from fastapi import APIRouter, Depends
from app.core.security import get_current_user

router = APIRouter()

@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """현재 로그인한 사용자 정보 반환"""
    return current_user
```

#### 3.2.4 User DB 연결 제거
**파일**: `backend/app/core/database.py`

- `user_db_engine` 제거 (더 이상 User DB 조회 불필요)
- 관련 세션 팩토리 제거

---

### Phase 3: Frontend Keycloak 연동

#### 3.3.1 NextAuth 설정
**신규 파일**: `frontend/app/api/auth/[...nextauth]/route.ts`

```typescript
import NextAuth from "next-auth"
import KeycloakProvider from "next-auth/providers/keycloak"

const handler = NextAuth({
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // 최초 로그인 시 access_token 저장
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
      }
      return token
    },
    async session({ session, token }) {
      // 세션에 access_token 포함
      session.accessToken = token.accessToken as string
      return session
    },
  },
})

export { handler as GET, handler as POST }
```

#### 3.3.2 Session Provider 추가
**신규 파일**: `frontend/lib/auth/session-provider.tsx`

```typescript
"use client"
import { SessionProvider } from "next-auth/react"

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

#### 3.3.3 Layout 수정
**파일**: `frontend/app/layout.tsx`

```typescript
import { AuthSessionProvider } from "@/lib/auth/session-provider"

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  )
}
```

#### 3.3.4 Auth Context 전면 교체
**파일**: `frontend/lib/auth/context.tsx`

```typescript
// 기존 코드 전체 삭제 후 next-auth 기반으로 교체
"use client"
import { useSession, signIn, signOut } from "next-auth/react"

export function useAuth() {
  const { data: session, status } = useSession()

  return {
    user: session?.user ?? null,
    accessToken: session?.accessToken ?? null,
    loading: status === "loading",
    isAuthenticated: status === "authenticated",
    login: () => signIn("keycloak"),
    logout: () => signOut({ callbackUrl: "/" }),
  }
}
```

#### 3.3.5 API Client 수정
**파일**: `frontend/lib/api/client.ts`

```typescript
import { getSession } from "next-auth/react"

class APIClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async getHeaders(): Promise<HeadersInit> {
    const session = await getSession()
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    }

    if (session?.accessToken) {
      headers["Authorization"] = `Bearer ${session.accessToken}`
    }

    return headers
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: await this.getHeaders(),
    })
    return response.json()
  }

  // post, put, delete 등도 동일하게 수정
}

// 기존 localStorage 관련 코드 모두 삭제
// - setToken() 삭제
// - getToken() 삭제
```

#### 3.3.6 로그인 페이지 수정
**파일**: `frontend/app/login/page.tsx`

```typescript
"use client"
import { useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      // 자동으로 Keycloak 로그인 페이지로 리다이렉트
      signIn("keycloak", { callbackUrl: "/dashboard" })
    } else if (status === "authenticated") {
      router.push("/dashboard")
    }
  }, [status, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>로그인 중...</p>
    </div>
  )
}
```

---

### Phase 4: 레거시 코드 제거

#### 3.4.1 Backend 삭제 대상 파일/코드

| 파일 | 삭제 내용 |
|------|----------|
| `app/core/security.py` | `verify_password()`, `get_password_hash()`, `create_access_token()`, `decode_access_token()` |
| `app/api/v1/endpoints/auth.py` | `login()` 엔드포인트 |
| `app/db/models/user.py` | `hashed_password` 필드 관련 로직 (모델은 유지 가능) |
| `requirements.txt` | `python-jose`, `passlib`, `bcrypt` |

#### 3.4.2 Frontend 삭제 대상

| 파일 | 삭제 내용 |
|------|----------|
| `lib/api/auth.ts` | `login()`, `logout()` 함수 (next-auth로 대체) |
| `lib/auth/context.tsx` | 기존 전체 코드 (next-auth 기반으로 교체) |
| `lib/api/client.ts` | `setToken()`, `getToken()`, localStorage 관련 코드 |
| `app/login/page.tsx` | 이메일/비밀번호 폼 전체 |

#### 3.4.3 환경 변수 제거

**Backend `.env`**:
```env
# 삭제
JWT_SECRET_KEY=xxx
JWT_ALGORITHM=xxx
JWT_EXPIRE_MINUTES=xxx
```

---

### Phase 5: 테스트

#### 3.5.1 테스트 항목

| 테스트 케이스 | 설명 |
|--------------|------|
| Keycloak 로그인 | Keycloak 로그인 페이지 리다이렉트 → 로그인 성공 → 앱 복귀 |
| 토큰 검증 | Backend에서 Keycloak 토큰 정상 검증 |
| 토큰 만료 | Access Token 만료 시 자동 갱신 |
| 로그아웃 | Keycloak 세션까지 완전 종료 |
| 권한 검증 | Keycloak Role 기반 접근 제어 |
| 미인증 접근 | 보호된 페이지 접근 시 로그인 리다이렉트 |

#### 3.5.2 테스트 환경 설정

```bash
# Keycloak 개발 환경 실행 (docker-compose에 추가 필요)
docker run -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:latest start-dev
```

---

## 4. 수정 필요 파일 목록

### 4.1 Backend

| 파일 | 작업 | 설명 |
|------|------|------|
| `app/core/keycloak.py` | 신규 생성 | Keycloak 연동 핵심 모듈 |
| `app/core/config.py` | 수정 | Keycloak 설정 추가, JWT 설정 제거 |
| `app/core/security.py` | 수정 | Keycloak 토큰 검증으로 전면 교체 |
| `app/api/v1/endpoints/auth.py` | 수정 | login 엔드포인트 삭제, me만 유지 |
| `requirements.txt` | 수정 | keycloak 추가, jose/passlib/bcrypt 제거 |
| `.env.example` | 수정 | Keycloak 설정 추가, JWT 설정 제거 |

### 4.2 Frontend

| 파일 | 작업 | 설명 |
|------|------|------|
| `app/api/auth/[...nextauth]/route.ts` | 신규 생성 | NextAuth API 라우트 |
| `lib/auth/session-provider.tsx` | 신규 생성 | 세션 프로바이더 |
| `lib/auth/context.tsx` | 전면 수정 | next-auth 기반으로 교체 |
| `lib/api/client.ts` | 수정 | next-auth 세션에서 토큰 획득 |
| `lib/api/auth.ts` | 삭제 | 더 이상 필요 없음 |
| `app/login/page.tsx` | 수정 | Keycloak 리다이렉트로 변경 |
| `app/layout.tsx` | 수정 | SessionProvider 추가 |
| `package.json` | 수정 | next-auth 추가 |

---

## 5. Keycloak 설정 요구사항

### 5.1 Realm 설정
```
Realm Name: mvp-vision
```

### 5.2 Client 설정 (labeler-frontend)
| 설정 | 값 |
|------|-----|
| Client ID | labeler-frontend |
| Client Protocol | openid-connect |
| Access Type | confidential |
| Valid Redirect URIs | http://localhost:3010/* |
| Web Origins | http://localhost:3010 |
| Root URL | http://localhost:3010 |

### 5.3 Client 설정 (labeler-backend) - 토큰 검증용
| 설정 | 값 |
|------|-----|
| Client ID | labeler-backend |
| Client Protocol | openid-connect |
| Access Type | confidential |

### 5.4 Realm Roles
| Role | 설명 |
|------|------|
| `admin` | 시스템 관리자 |
| `user` | 일반 사용자 |

### 5.5 사용자 마이그레이션
- 기존 사용자 정보를 Keycloak에 생성
- **비밀번호 재설정 필수** (bcrypt 해시 직접 이전 불가)
- 이메일로 비밀번호 재설정 링크 발송 권장

---

## 6. 작업 체크리스트

### Phase 1: 환경 설정
- [ ] Backend `requirements.txt`에 keycloak 패키지 추가
- [ ] Backend `requirements.txt`에서 jose/passlib/bcrypt 제거
- [ ] Backend `.env.example`에 Keycloak 설정 추가
- [ ] Frontend `package.json`에 next-auth 추가
- [ ] Frontend `.env.local` 생성 및 Keycloak 설정

### Phase 2: Backend 연동
- [ ] `app/core/keycloak.py` 생성
- [ ] `app/core/config.py` 수정 - Keycloak 설정 추가
- [ ] `app/core/security.py` 수정 - 레거시 함수 삭제, Keycloak 검증으로 교체
- [ ] `app/api/v1/endpoints/auth.py` 수정 - login 삭제

### Phase 3: Frontend 연동
- [ ] `app/api/auth/[...nextauth]/route.ts` 생성
- [ ] `lib/auth/session-provider.tsx` 생성
- [ ] `app/layout.tsx` 수정 - SessionProvider 추가
- [ ] `lib/auth/context.tsx` 전면 수정
- [ ] `lib/api/client.ts` 수정
- [ ] `app/login/page.tsx` 수정
- [ ] `lib/api/auth.ts` 삭제

### Phase 4: 정리
- [ ] 레거시 인증 코드 완전 제거 확인
- [ ] 환경 변수 정리

### Phase 5: 테스트
- [ ] Keycloak 로그인 테스트
- [ ] 토큰 검증 테스트
- [ ] 로그아웃 테스트
- [ ] 권한 검증 테스트

---

## 7. 리스크 및 고려사항

### 7.1 사용자 비밀번호
- **bcrypt 해시는 Keycloak으로 직접 이전 불가**
- 모든 기존 사용자에게 비밀번호 재설정 필요
- 마이그레이션 전 사용자 안내 이메일 발송 권장

### 7.2 Service-to-Service 인증
- Platform → Labeler 간 기존 Service JWT는 별도 검토 필요
- Keycloak Service Account로 전환 시 Platform 백엔드도 수정 필요

### 7.3 Keycloak 의존성
- Keycloak 서버 장애 시 전체 서비스 로그인 불가
- 고가용성 구성 권장 (클러스터링)

### 7.4 토큰 갱신
- Access Token 만료 시 Refresh Token으로 자동 갱신
- next-auth에서 자동 처리되나, 갱신 실패 시 재로그인 필요

---

## 8. 참고 자료

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [NextAuth.js Keycloak Provider](https://next-auth.js.org/providers/keycloak)
- [python-keycloak](https://python-keycloak.readthedocs.io/)
- [Authlib](https://docs.authlib.org/)
