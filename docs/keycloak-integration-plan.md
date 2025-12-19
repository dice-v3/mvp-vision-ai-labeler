# Keycloak 연동 계획서

## 1. 개요

### 1.1 목적
현재 자체 JWT 인증 시스템에서 Keycloak 기반 SSO(Single Sign-On) 인증으로 전환하여:
- 중앙 집중식 사용자 관리
- 표준 OAuth2/OIDC 프로토콜 활용
- 향후 다른 서비스와의 SSO 연동 용이

### 1.2 현재 상태
| 항목 | 현재 구현 |
|------|----------|
| 인증 방식 | 자체 JWT (python-jose) |
| 사용자 DB | PostgreSQL (User DB, port 5433) |
| 비밀번호 | bcrypt 해시 (passlib) |
| 토큰 만료 | 24시간 |
| 프론트엔드 | localStorage에 토큰 저장 |
| Service-to-Service | 별도 Service JWT (platform → labeler) |

### 1.3 목표 상태
| 항목 | 변경 후 |
|------|---------|
| 인증 방식 | Keycloak OIDC |
| 사용자 DB | Keycloak 내장 DB 또는 외부 연동 |
| 비밀번호 | Keycloak 관리 |
| 토큰 | Keycloak Access Token + Refresh Token |
| 프론트엔드 | Keycloak JS Adapter 또는 next-auth |
| Service-to-Service | 기존 방식 유지 또는 Keycloak Service Account |

---

## 2. 아키텍처 변경

### 2.1 현재 인증 플로우
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
[사용자] → [로그인 버튼] → [Keycloak 로그인 페이지로 리다이렉트]
                                      ↓
                            [Keycloak 인증 처리]
                                      ↓
                            [Authorization Code 발급]
                                      ↓
                            [Backend: Code → Token 교환]
                                      ↓
                            [Access Token + Refresh Token 발급]
                                      ↓
                            [API 요청 시 Keycloak 토큰 검증]
```

---

## 3. 단계별 작업 목록

### Phase 1: 환경 설정 및 의존성 추가

#### 3.1.1 Backend 의존성 추가
**파일**: `backend/requirements.txt`

```txt
# Keycloak/OIDC 관련
python-keycloak>=3.0.0    # Keycloak Admin API 클라이언트
authlib>=1.3.0            # OAuth2/OIDC 라이브러리
httpx>=0.26.0             # 비동기 HTTP 클라이언트 (이미 설치됨)
```

#### 3.1.2 Backend 환경 변수 추가
**파일**: `backend/.env.example`

```env
# Keycloak Configuration
KEYCLOAK_SERVER_URL=http://localhost:8080
KEYCLOAK_REALM=mvp-vision
KEYCLOAK_CLIENT_ID=labeler-backend
KEYCLOAK_CLIENT_SECRET=your-client-secret
KEYCLOAK_ADMIN_CLIENT_ID=admin-cli
KEYCLOAK_ADMIN_CLIENT_SECRET=admin-secret

# OAuth2 Callback URL
OAUTH2_REDIRECT_URI=http://localhost:3010/api/auth/callback
```

#### 3.1.3 Frontend 의존성 추가
**파일**: `frontend/package.json`

```json
{
  "dependencies": {
    "next-auth": "^4.24.0",
    "@auth/core": "^0.18.0"
  }
}
```

---

### Phase 2: Backend Keycloak 연동

#### 3.2.1 Keycloak 설정 모듈 생성
**신규 파일**: `backend/app/core/keycloak.py`

- Keycloak 서버 연결 설정
- 토큰 검증 함수
- 공개키 캐싱 (JWKS)
- 사용자 정보 조회

#### 3.2.2 인증 의존성 수정
**파일**: `backend/app/core/security.py`

| 함수 | 변경 내용 |
|------|----------|
| `get_current_user()` | Keycloak 토큰 검증으로 변경 |
| `decode_access_token()` | Keycloak JWT 디코딩 로직 |
| `verify_password()` | 삭제 또는 deprecated 처리 |
| `get_password_hash()` | 삭제 또는 deprecated 처리 |

#### 3.2.3 인증 엔드포인트 수정
**파일**: `backend/app/api/v1/endpoints/auth.py`

| 엔드포인트 | 현재 | 변경 후 |
|-----------|------|---------|
| `POST /auth/login` | 직접 로그인 | 제거 또는 Keycloak 리다이렉트 URL 반환 |
| `GET /auth/callback` | 없음 | 신규 - OAuth2 콜백 처리 |
| `POST /auth/refresh` | 없음 | 신규 - Refresh Token으로 갱신 |
| `POST /auth/logout` | 없음 | 신규 - Keycloak 세션 종료 |
| `GET /auth/me` | 유지 | Keycloak 토큰에서 사용자 정보 추출 |

#### 3.2.4 Service-to-Service 인증 유지
**파일**: `backend/app/core/service_jwt.py`

- 기존 Platform → Labeler 서비스 간 JWT 인증 유지
- 또는 Keycloak Service Account로 마이그레이션 (선택사항)

---

### Phase 3: Frontend Keycloak 연동

#### 3.3.1 next-auth 설정
**신규 파일**: `frontend/app/api/auth/[...nextauth]/route.ts`

```typescript
// NextAuth.js Keycloak Provider 설정
import KeycloakProvider from "next-auth/providers/keycloak"

export const authOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      issuer: process.env.KEYCLOAK_ISSUER,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) { ... },
    async session({ session, token }) { ... },
  },
}
```

#### 3.3.2 Auth Context 수정
**파일**: `frontend/lib/auth/context.tsx`

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| 로그인 | `apiClient.post('/auth/login')` | `signIn('keycloak')` |
| 로그아웃 | localStorage 삭제 | `signOut()` + Keycloak 로그아웃 |
| 토큰 관리 | localStorage | next-auth 세션 |
| 사용자 정보 | API 호출 | next-auth 세션에서 추출 |

#### 3.3.3 API Client 수정
**파일**: `frontend/lib/api/client.ts`

```typescript
// 변경 전
const token = localStorage.getItem('access_token')

// 변경 후
import { getSession } from 'next-auth/react'
const session = await getSession()
const token = session?.accessToken
```

#### 3.3.4 로그인 페이지 수정
**파일**: `frontend/app/login/page.tsx`

- 이메일/비밀번호 폼 제거
- "Keycloak으로 로그인" 버튼으로 변경
- 또는 Keycloak 로그인 페이지로 자동 리다이렉트

---

### Phase 4: 사용자 데이터 동기화

#### 3.4.1 기존 사용자 마이그레이션 전략

**옵션 A: Keycloak User Federation (권장)**
- Keycloak에서 기존 User DB를 User Federation으로 연결
- 사용자 정보는 기존 DB에 유지
- 인증만 Keycloak에서 처리

**옵션 B: 사용자 데이터 마이그레이션**
- 기존 사용자를 Keycloak으로 완전 이전
- 비밀번호 재설정 필요 (bcrypt 해시 호환 여부 확인)

**옵션 C: 하이브리드 (JIT Provisioning)**
- 첫 Keycloak 로그인 시 로컬 User DB에 사용자 생성
- 신규 사용자는 Keycloak에서만 관리

#### 3.4.2 User DB 동기화 처리
**신규 파일**: `backend/app/services/user_sync.py`

```python
async def sync_user_from_keycloak(keycloak_user_info: dict) -> User:
    """
    Keycloak 사용자 정보를 로컬 User DB와 동기화
    - 이미 존재하면 업데이트
    - 없으면 새로 생성
    """
    pass
```

#### 3.4.3 역할(Role) 매핑

| Keycloak Role | 애플리케이션 Role | 설명 |
|---------------|-----------------|------|
| `admin` | system_role: admin | 시스템 관리자 |
| `user` | system_role: user | 일반 사용자 |
| `project_owner` | ProjectPermission.role: owner | 프로젝트 소유자 |
| `project_admin` | ProjectPermission.role: admin | 프로젝트 관리자 |
| `project_reviewer` | ProjectPermission.role: reviewer | 리뷰어 |
| `project_annotator` | ProjectPermission.role: annotator | 라벨러 |
| `project_viewer` | ProjectPermission.role: viewer | 뷰어 |

---

### Phase 5: 보안 및 토큰 관리

#### 3.5.1 토큰 검증 로직
**파일**: `backend/app/core/keycloak.py`

```python
async def verify_keycloak_token(token: str) -> dict:
    """
    1. JWKS에서 공개키 조회 (캐싱)
    2. 토큰 서명 검증
    3. 만료 시간 확인
    4. 발급자(issuer) 확인
    5. Audience 확인
    """
    pass
```

#### 3.5.2 Refresh Token 처리
**파일**: `frontend/lib/auth/token-refresh.ts`

```typescript
// Access Token 만료 전 자동 갱신
// next-auth의 jwt callback에서 처리
```

#### 3.5.3 로그아웃 처리
```
[사용자 로그아웃]
      ↓
[next-auth signOut()]
      ↓
[Keycloak end_session_endpoint 호출]
      ↓
[모든 세션 종료]
```

---

### Phase 6: 테스트 및 롤아웃

#### 3.6.1 테스트 항목

| 테스트 케이스 | 설명 |
|--------------|------|
| 로그인 성공 | Keycloak 로그인 후 앱 접근 |
| 로그인 실패 | 잘못된 자격 증명 |
| 토큰 만료 | Access Token 만료 시 자동 갱신 |
| 토큰 갱신 실패 | Refresh Token 만료 시 재로그인 |
| 로그아웃 | 모든 세션 종료 확인 |
| 권한 검증 | 역할 기반 접근 제어 |
| Service-to-Service | Platform → Labeler 통신 |
| 기존 사용자 | 마이그레이션된 사용자 로그인 |

#### 3.6.2 롤아웃 전략

**단계 1: 개발 환경 테스트**
- 개발 환경에서 Keycloak 연동 완료
- 모든 테스트 케이스 통과

**단계 2: 기능 플래그 적용**
```python
# 환경 변수로 인증 방식 선택
AUTH_PROVIDER=keycloak  # 또는 'legacy'
```

**단계 3: 점진적 롤아웃**
- 일부 사용자 그룹에 먼저 적용
- 문제 발생 시 즉시 롤백 가능

**단계 4: 전체 적용**
- 모든 사용자에게 Keycloak 인증 적용
- 레거시 인증 코드 제거

---

## 4. 수정 필요 파일 목록

### 4.1 Backend (신규 생성)
| 파일 | 설명 |
|------|------|
| `app/core/keycloak.py` | Keycloak 연동 핵심 모듈 |
| `app/services/user_sync.py` | 사용자 동기화 서비스 |
| `app/api/v1/endpoints/oauth.py` | OAuth 콜백 엔드포인트 |

### 4.2 Backend (수정)
| 파일 | 변경 내용 |
|------|----------|
| `app/core/config.py` | Keycloak 설정 추가 |
| `app/core/security.py` | 토큰 검증 로직 변경 |
| `app/api/v1/endpoints/auth.py` | 엔드포인트 변경 |
| `requirements.txt` | 의존성 추가 |
| `.env.example` | 환경 변수 추가 |

### 4.3 Frontend (신규 생성)
| 파일 | 설명 |
|------|------|
| `app/api/auth/[...nextauth]/route.ts` | NextAuth API 라우트 |
| `lib/auth/session-provider.tsx` | 세션 프로바이더 |

### 4.4 Frontend (수정)
| 파일 | 변경 내용 |
|------|----------|
| `lib/auth/context.tsx` | 인증 컨텍스트 변경 |
| `lib/api/client.ts` | 토큰 획득 방식 변경 |
| `app/login/page.tsx` | 로그인 UI 변경 |
| `app/layout.tsx` | SessionProvider 추가 |
| `package.json` | next-auth 추가 |
| `.env.local` | Keycloak 설정 추가 |

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
| Access Type | public |
| Valid Redirect URIs | http://localhost:3010/* |
| Web Origins | http://localhost:3010 |

### 5.3 Client 설정 (labeler-backend)
| 설정 | 값 |
|------|-----|
| Client ID | labeler-backend |
| Client Protocol | openid-connect |
| Access Type | confidential |
| Service Accounts Enabled | Yes (선택) |

### 5.4 Realm Roles
- `admin`
- `user`

### 5.5 Client Roles (labeler-backend)
- `project_owner`
- `project_admin`
- `project_reviewer`
- `project_annotator`
- `project_viewer`

---

## 6. 예상 작업 체크리스트

### Phase 1: 환경 설정
- [ ] Backend requirements.txt에 keycloak 패키지 추가
- [ ] Backend .env.example에 Keycloak 설정 추가
- [ ] Frontend package.json에 next-auth 추가
- [ ] Frontend .env.local에 Keycloak 설정 추가

### Phase 2: Backend 연동
- [ ] `app/core/keycloak.py` 생성 - Keycloak 연동 모듈
- [ ] `app/core/config.py` 수정 - Keycloak 설정 클래스
- [ ] `app/core/security.py` 수정 - 토큰 검증 로직
- [ ] `app/api/v1/endpoints/auth.py` 수정 - 엔드포인트 변경
- [ ] 신규 OAuth 콜백 엔드포인트 생성

### Phase 3: Frontend 연동
- [ ] NextAuth 설정 파일 생성
- [ ] `lib/auth/context.tsx` 수정
- [ ] `lib/api/client.ts` 수정
- [ ] `app/login/page.tsx` 수정
- [ ] `app/layout.tsx` 수정 - SessionProvider

### Phase 4: 사용자 동기화
- [ ] User Federation 설정 또는 마이그레이션 스크립트
- [ ] `app/services/user_sync.py` 생성
- [ ] 역할 매핑 로직 구현

### Phase 5: 테스트
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 작성
- [ ] E2E 테스트 작성

### Phase 6: 배포
- [ ] 기능 플래그 구현
- [ ] 점진적 롤아웃
- [ ] 레거시 코드 정리

---

## 7. 리스크 및 고려사항

### 7.1 기존 사용자 영향
- 비밀번호 재설정 필요 여부 (bcrypt 호환성)
- 로그인 방식 변경에 대한 사용자 안내

### 7.2 Service-to-Service 인증
- Platform → Labeler 간 기존 Service JWT 유지 여부
- Keycloak Service Account 마이그레이션 시 Platform 수정 필요

### 7.3 오프라인 액세스
- Keycloak 서버 장애 시 서비스 영향
- 토큰 캐싱 전략

### 7.4 세션 관리
- 여러 기기에서 동시 로그인 처리
- 세션 타임아웃 정책

---

## 8. 참고 자료

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [NextAuth.js Keycloak Provider](https://next-auth.js.org/providers/keycloak)
- [python-keycloak](https://python-keycloak.readthedocs.io/)
- [FastAPI OAuth2](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/)
