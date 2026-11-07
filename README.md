# 마인드맵

여러 기기에서 동기화되는 가벼운 마인드맵 앱.

- 배포: https://mindmap-pink-two.vercel.app

## 스택
- React + Vite + TypeScript
- React Flow (캔버스) · Zustand (상태)
- Supabase (로그인 · Postgres · Realtime) + localStorage 캐시
- 배포: Vercel (main push 시 자동 배포)

## 개발
```bash
npm install
npm run dev
```
`.env`에 들어 있는 Supabase 키는 브라우저에 공개되는 publishable 키입니다.
실제 권한은 서버의 RLS 정책이 결정합니다.

## 구조
```
src/
  types.ts             데이터 모델 (MindMap, MindNode)
  themes.ts            테마 목록 (이름, 연결선 모양, 미리보기 색)
  theme.css            테마별 디자인 토큰 — 색/폰트/모양은 여기서만 수정
  palette.ts           카드 글자색 팔레트
  supabase.ts          Supabase 클라이언트
  storage/             저장 계층 (local.ts = 캐시, remote.ts = Supabase)
  sync/useSync.ts      로그인 상태 + 기기 간 동기화
  store/useMapStore.ts 트리 조작 로직
  layout/tree.ts       parent_id 트리 → 좌표 자동 배치
  components/          Sidebar, Canvas, MindNodeView, Login
```

## 동기화
- 편집하면 즉시 localStorage에 저장되고, 400ms 뒤 변경된 행만 Supabase에 upsert
- 다른 기기의 변경은 Realtime 구독으로 들어와 `updatedAt`이 더 최신일 때만 반영
- 오프라인에서 편집해도 다시 접속하면 올라감

## 접근 제어
`mindmap_allowed_emails` 테이블에 있는 이메일만 데이터를 읽고 쓸 수 있습니다.
사람을 추가하려면 그 표에 이메일을 한 줄 넣으면 됩니다.

## 단축키
| 키 | 동작 |
|---|---|
| Tab | 하위 카드 추가 (카드의 + 버튼과 동일) |
| Enter | 같은 단계 카드 추가 / 편집 중이면 확정 |
| Space | 접기 / 펼치기 |
| Delete | 카드 삭제 (하위 포함) |
| 방향키 | 카드 간 이동 |
| Ctrl+B | 굵게 |
| F2 · 더블클릭 · 글자 입력 | 편집 시작 |
| Esc | 편집 취소 |

드래그로 카드를 빈 곳에 놓으면 그 자리에 고정되고, 다른 카드 위에 놓으면 그 아래로 옮겨집니다.

카드를 부모보다 왼쪽에 놓으면 그 가지는 왼쪽으로 뻗습니다. 하위 카드도 같은 방향을
물려받고, 연결선·접기 버튼·방향키도 모두 그 방향을 따릅니다.

왼쪽 목록의 ≡ 손잡이를 끌면 순서를 바꿀 수 있습니다 (마우스·터치 모두).
폴더 머리글 위에 놓으면 그 폴더로 들어가고, 아래 빈 곳에 놓으면 폴더 밖으로 나옵니다.
폴더와 마인드맵 이름은 더블클릭해서 고칩니다. 폴더를 지워도 안의 마인드맵은 목록에 남습니다.

카드를 고르면 카드 바로 위 바에서 글자색·카드색·굵게를 바꾸고, "하위 정렬"로 그 카드
아래쪽만 자동 배치로 되돌릴 수 있습니다. 카드색은 고른 색을 연하게 깔고 같은 색
테두리를 둘러서, 밝은 테마와 어두운 테마 양쪽에서 글자가 읽히게 합니다.
