# 마인드맵

여러 기기에서 동기화되는 가벼운 마인드맵 앱.

## 스택
- React + Vite + TypeScript
- React Flow (캔버스) · Zustand (상태)
- 저장: localStorage (1단계) → Supabase (2단계 예정)
- 배포: Vercel

## 개발
```bash
npm install
npm run dev
```

## 구조
```
src/
  types.ts            데이터 모델 (MindMap, MindNode)
  theme.css           디자인 토큰 — 색/폰트/간격은 여기서만 수정
  index.css           레이아웃 및 컴포넌트 스타일
  storage/            저장 계층 (local.ts → 추후 supabase.ts 추가)
  store/useMapStore.ts 트리 조작 로직 (추가/삭제/이동/접기)
  layout/tree.ts      parent_id 트리 → 좌표 자동 배치
  components/         Sidebar, Canvas, MindNodeView
```

## 단축키
| 키 | 동작 |
|---|---|
| Tab | 자식 노드 추가 |
| Enter | 형제 노드 추가 (편집 중이면 확정) |
| Space | 접기/펼치기 |
| Delete / Backspace | 노드 삭제 (자손 포함) |
| 방향키 | 노드 간 이동 |
| F2 / 더블클릭 / 글자 입력 | 편집 시작 |
| Esc | 편집 취소 |
