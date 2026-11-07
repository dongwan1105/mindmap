import type { MindMap, MindNode } from "../types";
import type { StorageAdapter } from "./types";

const MAPS_KEY = "mindmap.maps";
const NODES_KEY = "mindmap.nodes";

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * 예전 버전에서 저장된 노드에는 나중에 추가한 필드(bold, x, y)가 없다.
 * 읽을 때 채워 두지 않으면 서버의 NOT NULL 제약에 걸린다.
 */
function normalize(n: Partial<MindNode>): MindNode {
  return {
    id: n.id!,
    mapId: n.mapId!,
    parentId: n.parentId ?? null,
    text: n.text ?? "",
    order: n.order ?? 0,
    collapsed: n.collapsed ?? false,
    color: n.color ?? null,
    bold: n.bold ?? false,
    x: n.x ?? null,
    y: n.y ?? null,
    updatedAt: n.updatedAt ?? Date.now(),
    deletedAt: n.deletedAt ?? null,
  };
}

export const localStorageAdapter: StorageAdapter = {
  async loadAll() {
    return {
      maps: read<MindMap>(MAPS_KEY),
      nodes: read<Partial<MindNode>>(NODES_KEY).filter((n) => n.id && n.mapId).map(normalize),
    };
  },
  async saveMaps(maps) {
    localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
  },
  async saveNodes(nodes) {
    localStorage.setItem(NODES_KEY, JSON.stringify(nodes));
  },
};
