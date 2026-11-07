import { useCallback, useLayoutEffect, useRef, useState } from "react";
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
  const { createMap, deleteMap, selectMap, setTheme, resetPositions, setTrashOpen } =
    useMapStore.getState();

  // 드래그로 순서 바꾸기. 손잡이에서만 시작하므로 항목 탭(선택)과 겹치지 않는다.
  const listRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<string | null>(null);
  const drag = useRef<{ startY: number; startTop: number; pointerY: number } | null>(null);
  const [liveOrder, setLiveOrder] = useState<string[] | null>(null);
  /** 드래그 중인 순서. 창 이벤트 핸들러에서도 읽어야 해서 ref에 둔다 */
  const orderRef = useRef<string[]>([]);
  /** 직전 프레임에서 각 항목이 있던 화면상 위치 (FLIP 애니메이션용) */
  const prevTops = useRef(new Map<string, number>());

  const sorted = maps
    .slice()
    .sort((a, b) => a.order - b.order || b.updatedAt - a.updatedAt);
  const shown = liveOrder
    ? (liveOrder.map((id) => sorted.find((m) => m.id === id)!).filter(Boolean) as typeof sorted)
    : sorted;

  const itemEl = (id: string) =>
    listRef.current?.querySelector<HTMLElement>(`[data-map-id="${id}"]`) ?? null;

  /**
   * 끄는 항목은 손가락 위치를 그대로 따라가고,
   * 비켜나는 항목들은 이전 위치에서 새 위치로 미끄러지듯 움직인다 (FLIP).
   */
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const els = Array.from(list.querySelectorAll<HTMLElement>("[data-map-id]"));
    const next = new Map<string, number>();

    for (const el of els) {
      const id = el.dataset.mapId!;
      el.style.transform = ""; // 원래 자리를 재기 위해 잠시 해제
      const slotTop = el.getBoundingClientRect().top;

      if (id === draggingId.current && drag.current) {
        // 끄는 항목은 손가락 위치를 그대로 따라간다
        const want = drag.current.startTop + (drag.current.pointerY - drag.current.startY);
        el.style.transform = `translateY(${want - slotTop}px)`;
        next.set(id, want); // 눈에 보이는 위치 (놓을 때 여기서부터 미끄러지도록)
        continue;
      }

      next.set(id, slotTop);
      const prev = prevTops.current.get(id);
      if (prev !== undefined && Math.abs(prev - slotTop) > 0.5) {
        // 비켜나는 항목은 이전 자리에서 새 자리로 미끄러진다.
        // style이 아니라 애니메이션으로 처리해 끝난 뒤 흔적이 남지 않게 한다.
        el.animate(
          [{ transform: `translateY(${prev - slotTop}px)` }, { transform: "none" }],
          { duration: 180, easing: "ease-out" },
        );
      }
    }
    prevTops.current = next;
  });

  /**
   * 포인터 캡처를 쓰지 않고 창에서 직접 받는다.
   * 순서가 바뀌면 React가 DOM 요소를 옮기는데, 그때 캡처가 풀려
   * 이후 움직임이 손잡이에 전달되지 않기 때문.
   */
  const onMove = useCallback((e: PointerEvent) => {
    const id = draggingId.current;
    const list = listRef.current;
    if (!id || !list || !drag.current) return;
    drag.current.pointerY = e.clientY;

    const items = Array.from(list.querySelectorAll<HTMLElement>("[data-map-id]"));

    /*
     * 자리 계산에는 offsetTop을 쓴다.
     * getBoundingClientRect는 미끄러지는 중인 항목의 "지금 보이는 위치"를 돌려주기
     * 때문에, 애니메이션이 도는 동안 측정하면 좌표가 엉킨다. offsetTop은 변형과
     * 무관한 실제 자리라서 흔들리지 않는다.
     */
    const listRect = list.getBoundingClientRect();
    const base = listRect.top - list.scrollTop - list.offsetTop;
    const slotTop = (el: HTMLElement) => base + el.offsetTop;

    // 손가락을 따라가는 움직임은 React를 거치지 않고 바로 반영한다 (끊기지 않게)
    const dragged = items.find((el) => el.dataset.mapId === id);
    if (dragged) {
      const want = drag.current.startTop + (e.clientY - drag.current.startY);
      dragged.style.transform = `translateY(${want - slotTop(dragged)}px)`;
    }

    const current = orderRef.current;
    let target = current.length - 1;
    for (let i = 0; i < items.length; i++) {
      if (e.clientY < slotTop(items[i]) + items[i].offsetHeight / 2) {
        target = i;
        break;
      }
    }
    const from = current.indexOf(id);
    if (from === -1 || from === target) return;
    const next = [...current];
    next.splice(from, 1);
    next.splice(target, 0, id);
    orderRef.current = next;
    setLiveOrder(next);
  }, []);

  const onUp = useCallback(() => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (draggingId.current && orderRef.current.length) {
      useMapStore.getState().reorderMaps(orderRef.current);
    }
    draggingId.current = null;
    drag.current = null;
    setLiveOrder(null); // 놓은 자리에서 제자리로 미끄러진다 (위 FLIP이 처리)
  }, [onMove]);

  const startDrag = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const top = itemEl(id)?.getBoundingClientRect().top ?? 0;
    draggingId.current = id;
    drag.current = { startY: e.clientY, startTop: top, pointerY: e.clientY };
    orderRef.current = sorted.map((m) => m.id);
    setLiveOrder(orderRef.current);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
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
            data-map-id={m.id}
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
