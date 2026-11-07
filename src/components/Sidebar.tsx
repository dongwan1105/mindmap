import { useMapStore } from "../store/useMapStore";
import { THEMES } from "../themes";

export default function Sidebar() {
  const allMaps = useMapStore((s) => s.maps);
  const maps = allMaps.filter((m) => !m.deletedAt);
  const currentMapId = useMapStore((s) => s.currentMapId);
  const theme = useMapStore((s) => s.theme);
  const hasPinned = useMapStore(
    (s) => s.nodes.some((n) => n.mapId === s.currentMapId && !n.deletedAt && n.x !== null),
  );
  const { createMap, deleteMap, selectMap, setTheme, resetPositions } = useMapStore.getState();

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <span>마인드맵</span>
        <button className="sidebar__add" title="새 마인드맵" onClick={() => createMap()}>
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
              onClick={() => selectMap(m.id)}
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
          onClick={() => currentMapId && resetPositions(currentMapId)}
        >
          자동 정렬로 되돌리기
        </button>
      </div>

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
