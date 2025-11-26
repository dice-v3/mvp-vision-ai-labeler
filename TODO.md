# TODO & Issues

## ISSUES

### Upload Progress & Completion Issue (2025-11-26)

**Status**: Needs Investigation

**Description**:
업로드 프로그레스바가 97%까지 진행되고, 첫 번째 파일에서 스피너가 계속 돌면서 완료되지 않는 문제.

**Observed Behavior**:
1. 프로그레스바가 97%까지 주욱 진행
2. 파일 리스트에서 첫 번째 파일만 스피너 표시 (uploading)
3. 나머지 파일들은 대기 상태 (pending)
4. 천천히 100%에 도달하지만 여전히 첫 번째 파일에서 멈춘 것처럼 보임
5. 한참을 기다려도 완료되지 않음
6. R2 Storage에는 모든 파일이 업로드된 것으로 보임 (완전히 확인은 안됨)

**Attempted Fixes** (Commit: 958ffd7):
1. Backend: 50개마다 DB commit 추가
   - 문제: 500개 INSERT가 pending 상태로 쌓여서 마지막 commit이 오래 걸림
   - 해결: `COMMIT_BATCH_SIZE = 50` 도입

2. Frontend: 파일 상태 업데이트 로직 수정
   - 문제: `findIndex()` 사용으로 첫 번째 파일만 업데이트
   - 해결: 정확한 배치 인덱스 (start ~ end) 사용

**Current Status**:
- 수정은 완료했으나 실제로 문제가 해결되었는지 확인 필요
- 면밀한 테스트와 분석 필요
- 추가 디버깅 로그 추가 검토

**Next Steps**:
- [ ] 다양한 파일 개수로 업로드 테스트 (10개, 50개, 100개, 500개)
- [ ] Backend 로그 확인 (commit 타이밍, 소요 시간)
- [ ] Frontend 상태 업데이트 로직 검증
- [ ] R2 업로드 vs DB commit 타이밍 분석
- [ ] 네트워크 타임아웃 설정 확인

**Related Files**:
- `backend/app/services/dataset_upload_service.py`
- `frontend/components/datasets/upload/Step4Upload.tsx`
- `backend/app/api/v1/endpoints/datasets.py` (add_images_to_dataset)

**Related Commits**:
- 958ffd7: fix: Resolve upload hanging issue with batch commits and status tracking

---

## TODO

(No pending tasks)
