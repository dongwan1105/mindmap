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

      <div className="sidebar__list">
        {maps
          .slice()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((m) => (
            <div
              key={m.id}
              className={`map-item${m.id === currentMapId ? " map-item--active" : ""}`}
              onClick={() => {
                selectMap(m.id);
                setTrashOpen(false);
                onNavigate?.();
              }}
            >
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
        드래그: 빈 곳에 놓으면 자리 고정, 다른 노드에 놓으면 그 아래로 이동
      </div>
    </aside>
  );
}
