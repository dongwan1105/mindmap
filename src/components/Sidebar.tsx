import { useRef, useState } from "react";
import { useMapStore } from "../store/useMapStore";
import { THEMES } from "../themes";
import { signOut, type SyncStatus } from "../sync/useSync";
import { trashEntries } from "./Trash";

const SYNC_LABEL: Record<SyncStatus, string> = {
  idle: "로컬 전용",
  syncing: "동기화 중…",
  synced: "동기화됨",
  error: "동기화 실패",
};

export default function Sidebar({
  email,
  syncStatus,
  onNavigate,
}: {
  email: string | null;
  syncStatus: SyncStatus;
  /** 좁은 화면에서 항목을 고르면 서랍을 닫는다 */
  onNavigate?: () => void;
}) {
  const allMaps = useMapStore((s) => s.maps);
  const maps = allMaps.filter((m) => !m.deletedAt);
  const currentMapId = useMapStore((s) => s.currentMapId);
  const theme = useMapStore((s) => s.theme);
  const hasPinned = useMapStore(
    (s) => s.nodes.some((n) => n.mapId === s.currentMapId && !n.deletedAt && n.x !== null),
  );
  const allNodes = useMapStore((s) => s.nodes);
  const trashCount = trashEntries(allMaps, allNodes).length;
  const { createMap, deleteMap, selectMap, setTheme, resetPositions, setTrashOpen, reorderMaps } =
    useMapStore.getState();

  // 드래그로 순서 바꾸기. 손잡이에서만 시작하므로 항목 탭(선택)과 겹치지 않는다.
  const listRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<string[] | null>(null);

  const sorted = maps
    .slice()
    .sort((a, b) => a.order - b.order || b.updatedAt - a.updatedAt);
  const shown = liveOrder
    ? (liveOrder.map((id) => sorted.find((m) => m.id === id)!).filter(Boolean) as typeof sorted)
    : sorted;

  const startDrag = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    draggingId.current = id;
    setLiveOrder(sorted.map((m) => m.id));
  };

  const moveDrag = (e: React.PointerEvent) => {
    const id = draggingId.current;
    if (!id || !listRef.current) return;
    const items = Array.from(listRef.current.querySelectorAll(".map-item")) as HTMLElement[];
    const current = liveOrder ?? sorted.map((m) => m.id);
    let target = current.length - 1;
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        target = i;
        break;
      }
    }
    const from = current.indexOf(id);
    if (from === -1 || from === target) return;
    const next = [...current];
    next.splice(from, 1);
    next.splice(target, 0, id);
    setLiveOrder(next);
  };

  const endDrag = () => {
    if (draggingId.current && liveOrder) reorderMaps(liveOrder);
    draggingId.current = null;
    setLiveOrder(null);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <span>마인드맵</span>
        <button
          className="sidebar__add"
          title="새 마인드맵"
          onClick={() => {
            createMap();
            setTrashOpen(false);
            onNavigate?.();
          }}
        >
          +
        </button>
      </div>

      <div className="sidebar__list" ref={listRef}>
        {shown.map((m) => (
          <div
            key={m.id}
            className={`map-item${m.id === currentMapId ? " map-item--active" : ""}${
              draggingId.current === m.id ? " map-item--dragging" : ""
            }`}
            onClick={() => {
              selectMap(m.id);
              setTrashOpen(false);
              onNavigate?.();
            }}
          >
            <span
              className="map-item__handle"
              title="끌어서 순서 바꾸기"
              onPointerDown={(e) => startDrag(e, m.id)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onClick={(e) => e.stopPropagation()}
            >
              ≡
            </span>
            <span className="map-item__title">{m.title || "제목 없음"}</span>
            <button
              className="map-item__delete"
              title="삭제"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`"${m.title}" 맵을 삭제할까요?`)) deleteMap(m.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar__section">
        <div className="sidebar__label">테마</div>
        <div className="theme-row">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-chip${t.id === theme ? " theme-chip--active" : ""}`}
              onClick={() => setTheme(t.id)}
              title={t.name}
            >
              <span className="theme-chip__swatch">
                {t.swatch.map((c, i) => (
                  <i key={i} style={{ background: c }} />
                ))}
              </span>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar__section">
        <button
          className="tool-button"
          disabled={!hasPinned}
          onClick={() => {
            if (currentMapId) resetPositions(currentMapId);
            onNavigate?.();
          }}
        >
          자동 정렬로 되돌리기
        </button>
        <button
          className="tool-button"
          onClick={() => {
            setTrashOpen(true);
            onNavigate?.();
          }}
        >
          휴지통{trashCount > 0 ? ` (${trashCount})` : ""}
        </button>
      </div>

      {email && (
        <div className="sidebar__section">
          <div className="account">
            <span className={`account__dot account__dot--${syncStatus}`} title={SYNC_LABEL[syncStatus]} />
            <span className="account__mail" title={email}>
              {email}
            </span>
            <button className="account__out" onClick={() => void signOut()}>
              로그아웃
            </button>
          </div>
        </div>
      )}

      <div className="sidebar__help">
        <kbd>Tab</kbd> 자식 · <kbd>Enter</kbd> 형제 · <kbd>Space</kbd> 접기 · <kbd>Del</kbd> 삭제
        <br />
        더블클릭 또는 글자 입력으로 편집 · 방향키로 이동
        <br />
        폰에서는 고른 카드를 한 번 더 탭하면 편집
        <br />
        드래그: 빈 곳에 놓으면 자리 고정, 다른 카드 위에 놓으면 그 아래로 이동
        <br />
        부모 왼쪽에 놓으면 그 가지는 왼쪽으로 뻗습니다
      </div>
    </aside>
  );
}
