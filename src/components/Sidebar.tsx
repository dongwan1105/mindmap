import { useMapStore } from "../store/useMapStore";

export default function Sidebar() {
  const allMaps = useMapStore((s) => s.maps);
  const maps = allMaps.filter((m) => !m.deletedAt);
  const currentMapId = useMapStore((s) => s.currentMapId);
  const { createMap, deleteMap, selectMap } = useMapStore.getState();

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
      <div className="sidebar__help">
        <kbd>Tab</kbd> 자식 추가 · <kbd>Enter</kbd> 형제 추가
        <br />
        <kbd>Space</kbd> 접기 · <kbd>Del</kbd> 삭제
        <br />
        더블클릭 또는 글자 입력으로 편집
        <br />
        방향키로 이동 · 드래그해서 다른 노드 아래로 옮기기
      </div>
    </aside>
  );
}
