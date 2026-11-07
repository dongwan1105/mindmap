import { useMapStore } from "../store/useMapStore";
import type { MindMap, MindNode } from "../types";

export interface TrashEntry {
  kind: "map" | "node";
  id: string;
  label: string;
  context: string;
  deletedAt: number;
  count: number;
}

/**
 * 휴지통에 보여줄 항목을 추려낸다.
 * 하위 카드까지 한꺼번에 지워진 경우, 사용자가 실제로 지운 "가지의 뿌리"만 보여준다.
 * (부모가 멀쩡하거나, 부모가 다른 때에 지워졌으면 그 카드는 따로 지워진 것)
 */
export function trashEntries(maps: MindMap[], nodes: MindNode[]): TrashEntry[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const mapTitle = new Map(maps.map((m) => [m.id, m.title || "제목 없음"]));
  const deadMaps = new Set(maps.filter((m) => m.deletedAt !== null).map((m) => m.id));

  const countSubtree = (rootId: string, at: number) => {
    const ids = new Set([rootId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of nodes) {
        if (!ids.has(n.id) && n.parentId && ids.has(n.parentId) && n.deletedAt === at) {
          ids.add(n.id);
          grew = true;
        }
      }
    }
    return ids.size;
  };

  const entries: TrashEntry[] = [];

  for (const m of maps) {
    if (m.deletedAt === null) continue;
    entries.push({
      kind: "map",
      id: m.id,
      label: m.title || "제목 없음",
      context: "마인드맵 전체",
      deletedAt: m.deletedAt,
      count: nodes.filter((n) => n.mapId === m.id && n.deletedAt === m.deletedAt).length,
    });
  }

  for (const n of nodes) {
    if (n.deletedAt === null) continue;
    if (deadMaps.has(n.mapId)) continue; // 맵 항목에 포함되어 있다
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    const parentAlsoDeletedTogether = parent && parent.deletedAt === n.deletedAt;
    if (parentAlsoDeletedTogether) continue; // 가지의 뿌리가 아니다
    entries.push({
      kind: "node",
      id: n.id,
      label: n.text || "(빈 카드)",
      context: mapTitle.get(n.mapId) ?? "",
      deletedAt: n.deletedAt,
      count: countSubtree(n.id, n.deletedAt),
    });
  }

  return entries.sort((a, b) => b.deletedAt - a.deletedAt);
}

function when(ts: number) {
  const d = new Date(ts);
  const sameDay = new Date().toDateString() === d.toDateString();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return sameDay ? `오늘 ${hm}` : `${d.getMonth() + 1}월 ${d.getDate()}일 ${hm}`;
}

export default function Trash() {
  const maps = useMapStore((s) => s.maps);
  const nodes = useMapStore((s) => s.nodes);
  const { setTrashOpen, restoreMap, restoreNode, purgeMap, purgeNode, emptyTrash } =
    useMapStore.getState();

  const entries = trashEntries(maps, nodes);

  return (
    <div className="trash">
      <div className="trash__bar">
        <h2 className="trash__title">휴지통</h2>
        <div className="trash__actions">
          {entries.length > 0 && (
            <button
              className="trash__empty"
              onClick={() => {
                if (
                  confirm(
                    `휴지통의 ${entries.length}개 항목을 영구 삭제할까요?\n되돌릴 수 없습니다.`,
                  )
                )
                  emptyTrash();
              }}
            >
              휴지통 비우기
            </button>
          )}
          <button className="trash__close" onClick={() => setTrashOpen(false)}>
            닫기
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="trash__none">휴지통이 비어 있습니다.</p>
      ) : (
        <ul className="trash__list">
          {entries.map((e) => (
            <li key={`${e.kind}-${e.id}`} className="trash-item">
              <div className="trash-item__main">
                <span className="trash-item__label">{e.label}</span>
                <span className="trash-item__meta">
                  {e.context}
                  {e.count > 1 && ` · 카드 ${e.count}개`} · {when(e.deletedAt)}
                </span>
              </div>
              <button
                className="trash-item__btn"
                onClick={() => {
                  if (e.kind === "map") restoreMap(e.id);
                  else restoreNode(e.id);
                  setTrashOpen(false);
                }}
              >
                복원
              </button>
              <button
                className="trash-item__btn trash-item__btn--danger"
                onClick={() => {
                  if (confirm(`"${e.label}"을(를) 영구 삭제할까요?\n되돌릴 수 없습니다.`)) {
                    if (e.kind === "map") purgeMap(e.id);
                    else purgeNode(e.id);
                  }
                }}
              >
                영구 삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
