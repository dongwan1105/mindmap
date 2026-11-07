import type { MindFolder, MindMap, MindNode } from "../types";

/**
 * 저장 계층 인터페이스.
 * 지금은 localStorage 구현만 있고, 나중에 Supabase 구현으로 교체한다.
 */
export interface StorageAdapter {
  loadAll(): Promise<{ folders: MindFolder[]; maps: MindMap[]; nodes: MindNode[] }>;
  saveFolders(folders: MindFolder[]): Promise<void>;
  saveMaps(maps: MindMap[]): Promise<void>;
  saveNodes(nodes: MindNode[]): Promise<void>;
}
