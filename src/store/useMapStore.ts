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
  /** 목록에 보이는 순서대로 맵 순서를 다시 매긴다 */
  reorderMaps: (orderedIds: string[]) => void;
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
  setNodeStyle: (
    id: string,
    style: { color?: string | null; bg?: string | null; bold?: boolean },
  ) => void;
  /** 이 카드의 하위 카드들을 자동 배치로 되돌린다 (직접 옮긴 좌표 해제) */
  arrangeChildren: (id: string) => void;
  resetPositions: (mapId: string) => void;

  /** 서버에서 받은 행을 updatedAt 기준으로 병합한다. 더 오래된 행은 무시. */
  mergeRemote: (maps: MindMap[], nodes: MindNode[]) => void;
  /** 맵이 하나도 없으면 첫 맵을 만든다. */
  ensureFirstMap: () => void;
  /** 로그아웃 시 로컬 캐시를 비운다. */
  clearLocal: () => void;

  trashOpen: boolean;
  setTrashOpen: (open: boolean) => void;
  restoreMap: (id: string) => void;
  restoreNode: (id: string) => void;
  purgeMap: (id: string) => void;
  purgeNode: (id: string) => void;
  emptyTrash: () => void;
  /** 서버에서 영구 삭제된 행을 로컬에서도 없앤다 (다른 기기의 삭제 반영) */
  removeLocal: (mapIds: string[], nodeIds: string[]) => void;

  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const now = () => Date.now();

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 영구 삭제된 행의 id. 동기화 모듈이 서버에서 지운 뒤 비운다.
 * soft delete와 달리 업서트로는 표현할 수 없어 따로 모은다.
 */
export const pendingPurge = { maps: new Set<string>(), nodes: new Set<string>() };

/** 동기화 모듈이 등록하는 콜백. 로컬 저장이 끝날 때마다 호출된다. */
let onLocalChange: (() => void) | null = null;
export function setSyncHook(fn: (() => void) | null) {
  onLocalChange = fn;
}

function schedulePersist(get: () => MapState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { maps, nodes } = get();
    void storage.saveMaps(maps);
    void storage.saveNodes(nodes);
    onLocalChange?.();
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
    trashOpen: false,
    theme: (localStorage.getItem(THEME_KEY) as ThemeId) || DEFAULT_THEME,

    async load() {
      if (get().loaded) return; // 두 번 불려도 이미 있는 상태를 덮어쓰지 않는다
      const { maps, nodes } = await storage.loadAll();
      const live = maps.filter((m) => !m.deletedAt);
      set({
        maps,
        nodes,
        currentMapId: live[0]?.id ?? null,
        loaded: true,
      });
      // 옛 형식이 보정됐을 수 있으므로 캐시를 한 번 갱신해 둔다
      void storage.saveNodes(nodes);
    },

    createMap(title = "새 마인드맵") {
      const mapId = nanoid();
      const t = now();
      // 새 맵은 목록 맨 위로
      const minOrder = get().maps.reduce((m, x) => Math.min(m, x.order), 0);
      const map: MindMap = {
        id: mapId,
        title,
        order: minOrder - 1,
        createdAt: t,
        updatedAt: t,
        deletedAt: null,
      };
      const root: MindNode = {
        id: nanoid(),
        mapId,
        parentId: null,
        text: title,
        order: 0,
        collapsed: false,
        color: null,
        bg: null,
        bold: false,
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

    reorderMaps(orderedIds) {
      const t = now();
      const rank = new Map(orderedIds.map((id, i) => [id, i]));
      set((s) => ({
        maps: s.maps.map((m) => {
          const r = rank.get(m.id);
          return r === undefined || m.order === r ? m : { ...m, order: r, updatedAt: t };
        }),
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
        bg: null,
        bold: false,
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
        bg: null,
        bold: false,
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

    setNodeStyle(id, style) {
      const node = get().nodes.find((n) => n.id === id);
      if (!node) return;
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...style, updatedAt: now() } : n)),
      }));
      touchMap(node.mapId);
      persist();
    },

    arrangeChildren(id) {
      const all = get().nodes;
      const ids = new Set<string>();
      let frontier = [id];
      while (frontier.length) {
        const next: string[] = [];
        for (const n of all) {
          if (!n.deletedAt && n.parentId && frontier.includes(n.parentId) && !ids.has(n.id)) {
            ids.add(n.id);
            next.push(n.id);
          }
        }
        frontier = next;
      }
      if (!ids.size) return;
      const t = now();
      set((s) => ({
        nodes: s.nodes.map((n) =>
          ids.has(n.id) && (n.x !== null || n.y !== null)
            ? { ...n, x: null, y: null, updatedAt: t }
            : n,
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

    mergeRemote(remoteMaps, remoteNodes) {
      set((s) => {
        const maps = [...s.maps];
        const nodes = [...s.nodes];
        const mapIdx = new Map(maps.map((m, i) => [m.id, i]));
        const nodeIdx = new Map(nodes.map((n, i) => [n.id, i]));

        for (const r of remoteMaps) {
          const i = mapIdx.get(r.id);
          if (i === undefined) maps.push(r);
          else if (r.updatedAt > maps[i].updatedAt) maps[i] = r;
        }
        for (const r of remoteNodes) {
          const i = nodeIdx.get(r.id);
          if (i === undefined) nodes.push(r);
          else if (r.updatedAt > nodes[i].updatedAt) nodes[i] = r;
        }

        const live = maps.filter((m) => !m.deletedAt);
        const stillThere = live.some((m) => m.id === s.currentMapId);
        return {
          maps,
          nodes,
          currentMapId: stillThere ? s.currentMapId : (live[0]?.id ?? null),
        };
      });
      // 서버에서 온 내용도 로컬 캐시에 남긴다 (오프라인 대비)
      const { maps, nodes } = get();
      void storage.saveMaps(maps);
      void storage.saveNodes(nodes);
    },

    ensureFirstMap() {
      if (get().maps.some((m) => !m.deletedAt)) return;
      get().createMap("내 첫 마인드맵");
    },

    clearLocal() {
      set({ maps: [], nodes: [], currentMapId: null, selectedNodeId: null, editingNodeId: null });
      void storage.saveMaps([]);
      void storage.saveNodes([]);
    },

    setTrashOpen(open) {
      set({ trashOpen: open });
    },

    restoreMap(id) {
      const map = get().maps.find((m) => m.id === id);
      if (!map || map.deletedAt === null) return;
      const at = map.deletedAt;
      const t = now();
      set((s) => ({
        maps: s.maps.map((m) => (m.id === id ? { ...m, deletedAt: null, updatedAt: t } : m)),
        // 맵과 같이 지워진 카드만 되살린다 (그 전에 따로 지운 카드는 휴지통에 남는다)
        nodes: s.nodes.map((n) =>
          n.mapId === id && n.deletedAt === at ? { ...n, deletedAt: null, updatedAt: t } : n,
        ),
        currentMapId: id,
      }));
      persist();
    },

    restoreNode(id) {
      const node = get().nodes.find((n) => n.id === id);
      if (!node || node.deletedAt === null) return;
      const at = node.deletedAt;
      const t = now();
      // 함께 지워진 자손만 되살린다
      const ids = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of get().nodes) {
          if (!ids.has(n.id) && n.parentId && ids.has(n.parentId) && n.deletedAt === at) {
            ids.add(n.id);
            grew = true;
          }
        }
      }
      set((s) => ({
        nodes: s.nodes.map((n) =>
          ids.has(n.id) ? { ...n, deletedAt: null, updatedAt: t } : n,
        ),
        currentMapId: node.mapId,
        selectedNodeId: id,
      }));
      touchMap(node.mapId);
      persist();
    },

    purgeMap(id) {
      const nodeIds = get()
        .nodes.filter((n) => n.mapId === id)
        .map((n) => n.id);
      pendingPurge.maps.add(id);
      nodeIds.forEach((n) => pendingPurge.nodes.add(n));
      set((s) => ({
        maps: s.maps.filter((m) => m.id !== id),
        nodes: s.nodes.filter((n) => n.mapId !== id),
      }));
      persist();
    },

    purgeNode(id) {
      const all = get().nodes;
      const ids = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of all) {
          if (!ids.has(n.id) && n.parentId && ids.has(n.parentId)) {
            ids.add(n.id);
            grew = true;
          }
        }
      }
      ids.forEach((n) => pendingPurge.nodes.add(n));
      set((s) => ({ nodes: s.nodes.filter((n) => !ids.has(n.id)) }));
      persist();
    },

    emptyTrash() {
      const { maps, nodes } = get();
      const deadMaps = maps.filter((m) => m.deletedAt !== null).map((m) => m.id);
      const deadMapSet = new Set(deadMaps);
      const deadNodes = nodes
        .filter((n) => n.deletedAt !== null || deadMapSet.has(n.mapId))
        .map((n) => n.id);
      if (!deadMaps.length && !deadNodes.length) return;
      deadMaps.forEach((id) => pendingPurge.maps.add(id));
      deadNodes.forEach((id) => pendingPurge.nodes.add(id));
      const deadNodeSet = new Set(deadNodes);
      set((s) => ({
        maps: s.maps.filter((m) => !deadMapSet.has(m.id)),
        nodes: s.nodes.filter((n) => !deadNodeSet.has(n.id)),
      }));
      persist();
    },

    removeLocal(mapIds, nodeIds) {
      if (!mapIds.length && !nodeIds.length) return;
      const m = new Set(mapIds);
      const n = new Set(nodeIds);
      set((s) => ({
        maps: s.maps.filter((x) => !m.has(x.id)),
        nodes: s.nodes.filter((x) => !n.has(x.id) && !m.has(x.mapId)),
      }));
      const { maps, nodes } = get();
      void storage.saveMaps(maps);
      void storage.saveNodes(nodes);
    },

    setTheme(theme) {
      localStorage.setItem(THEME_KEY, theme);
      set({ theme });
    },
  };
});
