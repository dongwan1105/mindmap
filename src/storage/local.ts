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

export const localStorageAdapter: StorageAdapter = {
  async loadAll() {
    return { maps: read<MindMap>(MAPS_KEY), nodes: read<MindNode>(NODES_KEY) };
  },
  async saveMaps(maps) {
    localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
  },
  async saveNodes(nodes) {
    localStorage.setItem(NODES_KEY, JSON.stringify(nodes));
  },
};
