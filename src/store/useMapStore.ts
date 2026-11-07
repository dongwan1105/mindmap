import { create } from "zustand";
import { nanoid } from "nanoid";
import type { MindMap, MindNode } from "../types";
import type { StorageAdapter } from "../storage/types";
import { localStorageAdapter } from "../storage/local";
import { DEFAULT_THEME, type ThemeId } from "../themes";

const THEME_KEY = "mindmap.theme";

const storage: StorageAdapter = localStorageAdapter;

interface MapState {
  maps: MindMap[];
  nodes: MindNode[];
  currentMapId: string | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  /** 글자를 눌러 편집을 시작한 경우 그 첫 글자 */
  editingInitial: string | null;
  loaded: boolean;

  load: () => Promise<void>;

  createMap: (title?: string) => void;
  deleteMap: (id: string) => void;
  renameMap: (id: string, title: string) => void;
  selectMap: (id: string) => void;

  selectNode: (id: string | null) => void;
  startEditing: (id: string | null, initialText?: string) => void;
  updateNodeText: (id: string, text: string) => void;
  addChild: (parentId: string) => string;
  addSibling: (nodeId: string) => string | null;
  deleteNode: (id: string) => void;
  toggleCollapse: (id: string) => void;
  moveNode: (id: string, newParentId: string) => void;
  setNodePosition: (id: string, x: number, y: number) => void;
  resetPositions: (mapId: string) => void;

  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const now = () => Date.now();

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(get: () => MapState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { maps, nodes } = get();
    void storage.saveMaps(maps);
    void storage.saveNodes(nodes);
  }, 300);
}

export const useMapStore = create<MapState>((set, get) => {
  const persist = () => schedulePersist(get);

  const touchMap = (mapId: string) =>
    set((s) => ({
      maps: s.maps.map((m) => (m.id === mapId ? { ...m, updatedAt: now() } : m)),
    }));

  return {
    maps: [],
    nodes: [],
    currentMapId: null,
    selectedNodeId: null,
    editingNodeId: null,
    editingInitial: null,
    loaded: false,
    theme: (localStorage.getItem(THEME_KEY) as ThemeId) || DEFAULT_THEME,

    async load() {
      const { maps, nodes } = await storage.loadAll();
      const live = maps.filter((m) => !m.deletedAt);
      set({
        maps,
        nodes,
        currentMapId: live[0]?.id ?? null,
        loaded: true,
      });
      if (live.length === 0) get().createMap("내 첫 마인드맵");
    },

    createMap(title = "새 마인드맵") {
      const mapId = nanoid();
      const t = now();
      const map: MindMap = { id: mapId, title, createdAt: t, updatedAt: t, deletedAt: null };
      const root: MindNode = {
        id: nanoid(),
        mapId,
        parentId: null,
        text: title,
        order: 0,
        collapsed: false,
        color: null,
        x: null,
        y: null,
        updatedAt: t,
        deletedAt: null,
      };
      set((s) => ({
        maps: [...s.maps, map],
        nodes: [...s.nodes, root],
        currentMapId: mapId,
        selectedNodeId: root.id,
        editingNodeId: null,
      }));
      persist();
    },

    deleteMap(id) {
      const t = now();
      set((s) => {
        const maps = s.maps.map((m) => (m.id === id ? { ...m, deletedAt: t } : m));
        const live = maps.filter((m) => !m.deletedAt);
        return {
          maps,
          nodes: s.nodes.map((n) => (n.mapId === id ? { ...n, deletedAt: t } : n)),
          currentMapId: s.currentMapId === id ? (live[0]?.id ?? null) : s.currentMapId,
          selectedNodeId: null,
          editingNodeId: null,
        };
      });
      persist();
    },

    renameMap(id, title) {
      set((s) => ({
        maps: s.maps.map((m) => (m.id === id ? { ...m, title, updatedAt: now() } : m)),
      }));
      persist();
    },

    selectMap(id) {
      set({ currentMapId: id, selectedNodeId: null, editingNodeId: null });
    },

    selectNode(id) {
      set({ selectedNodeId: id });
    },

    startEditing(id, initialText) {
      set({
        editingNodeId: id,
        editingInitial: initialText ?? null,
        selectedNodeId: id ?? get().selectedNodeId,
      });
    },

    updateNodeText(id, text) {
      const node = get().nodes.find((n) => n.id === id);
      if (!node) return;
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, text, updatedAt: now() } : n)),
      }));
      // 루트 노드 텍스트는 맵 제목과 동기화
      if (node.parentId === null) get().renameMap(node.mapId, text);
      touchMap(node.mapId);
      persist();
    },

    addChild(parentId) {
      const parent = get().nodes.find((n) => n.id === parentId);
      if (!parent) return "";
      const siblings = get().nodes.filter((n) => n.parentId === parentId && !n.deletedAt);
      const node: MindNode = {
        id: nanoid(),
        mapId: parent.mapId,
        parentId,
        text: "",
        order: siblings.length,
        collapsed: false,
        color: null,
        x: null,
        y: null,
        updatedAt: now(),
        deletedAt: null,
      };
      set((s) => ({
        nodes: [
          ...s.nodes.map((n) => (n.id === parentId ? { ...n, collapsed: false } : n)),
          node,
        ],
        selectedNodeId: node.id,
        editingNodeId: node.id,
        editingInitial: null,
      }));
      touchMap(parent.mapId);
      persist();
      return node.id;
    },

    addSibling(nodeId) {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node || node.parentId === null) return null; // 루트는 형제 없음
      const siblings = get()
        .nodes.filter((n) => n.parentId === node.parentId && !n.deletedAt)
        .sort((a, b) => a.order - b.order);
      const idx = siblings.findIndex((s) => s.id === nodeId);
      const newNode: MindNode = {
        id: nanoid(),
        mapId: node.mapId,
        parentId: node.parentId,
        text: "",
        order: idx + 1,
        collapsed: false,
        color: null,
        x: null,
        y: null,
        updatedAt: now(),
        deletedAt: null,
      };
      const t = now();
      set((s) => ({
        nodes: [
          ...s.nodes.map((n) =>
            n.parentId === node.parentId && !n.deletedAt && n.order > idx
              ? { ...n, order: n.order + 1, updatedAt: t }
              : n,
          ),
          newNode,
        ],
        selectedNodeId: newNode.id,
        editingNodeId: newNode.id,
        editingInitial: null,
      }));
      touchMap(node.mapId);
      persist();
      return newNode.id;
    },

    deleteNode(id) {
      const { nodes } = get();
      const target = nodes.find((n) => n.id === id);
      if (!target || target.parentId === null) return; // 루트는 삭제 불가
      const toDelete = new Set<string>();
      const walk = (nid: string) => {
        toDelete.add(nid);
        nodes.filter((n) => n.parentId === nid).forEach((c) => walk(c.id));
      };
      walk(id);
      const t = now();
      set((s) => ({
        nodes: s.nodes.map((n) => (toDelete.has(n.id) ? { ...n, deletedAt: t, updatedAt: t } : n)),
        selectedNodeId: target.parentId,
        editingNodeId: null,
      }));
      touchMap(target.mapId);
      persist();
    },

    toggleCollapse(id) {
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, collapsed: !n.collapsed, updatedAt: now() } : n,
        ),
      }));
      persist();
    },

    moveNode(id, newParentId) {
      const { nodes } = get();
      const node = nodes.find((n) => n.id === id);
      if (!node || node.parentId === null || id === newParentId) return;
      // 자기 자손 밑으로는 이동 불가
      let cur: MindNode | undefined = nodes.find((n) => n.id === newParentId);
      while (cur) {
        if (cur.id === id) return;
        cur = cur.parentId ? nodes.find((n) => n.id === cur!.parentId) : undefined;
      }
      const siblings = nodes.filter((n) => n.parentId === newParentId && !n.deletedAt);
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                parentId: newParentId,
                order: siblings.length,
                x: null,
                y: null,
                updatedAt: now(),
              }
            : n,
        ),
      }));
      touchMap(node.mapId);
      persist();
    },

    setNodePosition(id, x, y) {
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, x: Math.round(x), y: Math.round(y), updatedAt: now() } : n,
        ),
      }));
      persist();
    },

    resetPositions(mapId) {
      const t = now();
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.mapId === mapId && (n.x !== null || n.y !== null)
            ? { ...n, x: null, y: null, updatedAt: t }
            : n,
        ),
      }));
      persist();
    },

    setTheme(theme) {
      localStorage.setItem(THEME_KEY, theme);
      set({ theme });
    },
  };
});
