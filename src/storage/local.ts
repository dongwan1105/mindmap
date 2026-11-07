import type { MindFolder, MindMap, MindNode } from "../types";
import type { StorageAdapter } from "./types";

const FOLDERS_KEY = "mindmap.folders";
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
    bg: n.bg ?? null,
    bold: n.bold ?? false,
    x: n.x ?? null,
    y: n.y ?? null,
    updatedAt: n.updatedAt ?? Date.now(),
    deletedAt: n.deletedAt ?? null,
  };
}

function normalizeFolder(f: Partial<MindFolder>): MindFolder {
  return {
    id: f.id!,
    name: f.name ?? "",
    order: f.order ?? 0,
    collapsed: f.collapsed ?? false,
    createdAt: f.createdAt ?? Date.now(),
    updatedAt: f.updatedAt ?? Date.now(),
    deletedAt: f.deletedAt ?? null,
  };
}

function normalizeMap(m: Partial<MindMap>): MindMap {
  return {
    id: m.id!,
    title: m.title ?? "",
    folderId: m.folderId ?? null,
    order: m.order ?? 0,
    createdAt: m.createdAt ?? Date.now(),
    updatedAt: m.updatedAt ?? Date.now(),
    deletedAt: m.deletedAt ?? null,
  };
}

export const localStorageAdapter: StorageAdapter = {
  async loadAll() {
    return {
      folders: read<Partial<MindFolder>>(FOLDERS_KEY).filter((f) => f.id).map(normalizeFolder),
      maps: read<Partial<MindMap>>(MAPS_KEY).filter((m) => m.id).map(normalizeMap),
      nodes: read<Partial<MindNode>>(NODES_KEY).filter((n) => n.id && n.mapId).map(normalize),
    };
  },
  async saveFolders(folders) {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  },
  async saveMaps(maps) {
    localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
  },
  async saveNodes(nodes) {
    localStorage.setItem(NODES_KEY, JSON.stringify(nodes));
  },
};
