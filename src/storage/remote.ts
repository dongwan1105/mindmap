import { supabase } from "../supabase";
import type { MindFolder, MindMap, MindNode } from "../types";

/** DB는 snake_case, 앱은 camelCase — 변환은 전부 여기서만 한다. */

type FolderRow = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  collapsed: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

type MapRow = {
  id: string;
  user_id: string;
  title: string;
  folder_id: string | null;
  sort_order: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

type NodeRow = {
  id: string;
  map_id: string;
  user_id: string;
  parent_id: string | null;
  text: string;
  sort_order: number;
  collapsed: boolean;
  color: string | null;
  bg: string | null;
  bold: boolean;
  x: number | null;
  y: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

export const rowToFolder = (r: FolderRow): MindFolder => ({
  id: r.id,
  name: r.name,
  order: r.sort_order ?? 0,
  collapsed: r.collapsed ?? false,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
  deletedAt: r.deleted_at === null ? null : Number(r.deleted_at),
});

export const folderToRow = (f: MindFolder, userId: string): FolderRow => ({
  id: f.id,
  user_id: userId,
  name: f.name ?? "",
  sort_order: f.order ?? 0,
  collapsed: f.collapsed ?? false,
  created_at: f.createdAt,
  updated_at: f.updatedAt,
  deleted_at: f.deletedAt ?? null,
});

export const rowToMap = (r: MapRow): MindMap => ({
  id: r.id,
  title: r.title,
  folderId: r.folder_id ?? null,
  order: r.sort_order ?? 0,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
  deletedAt: r.deleted_at === null ? null : Number(r.deleted_at),
});

export const mapToRow = (m: MindMap, userId: string): MapRow => ({
  id: m.id,
  user_id: userId,
  title: m.title ?? "",
  folder_id: m.folderId ?? null,
  sort_order: m.order ?? 0,
  created_at: m.createdAt,
  updated_at: m.updatedAt,
  deleted_at: m.deletedAt,
});

export const rowToNode = (r: NodeRow): MindNode => ({
  id: r.id,
  mapId: r.map_id,
  parentId: r.parent_id,
  text: r.text,
  order: r.sort_order,
  collapsed: r.collapsed,
  color: r.color,
  bg: r.bg ?? null,
  bold: r.bold,
  x: r.x,
  y: r.y,
  updatedAt: Number(r.updated_at),
  deletedAt: r.deleted_at === null ? null : Number(r.deleted_at),
});

export const nodeToRow = (n: MindNode, userId: string): NodeRow => ({
  id: n.id,
  map_id: n.mapId,
  user_id: userId,
  // NOT NULL 컬럼은 반드시 값을 채운다. 옛 로컬 데이터에 빠진 필드가 있을 수 있다.
  parent_id: n.parentId ?? null,
  text: n.text ?? "",
  sort_order: n.order ?? 0,
  collapsed: n.collapsed ?? false,
  color: n.color ?? null,
  bg: n.bg ?? null,
  bold: n.bold ?? false,
  x: n.x ?? null,
  y: n.y ?? null,
  created_at: 0,
  updated_at: n.updatedAt,
  deleted_at: n.deletedAt ?? null,
});

export async function isAllowed(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("mindmap_is_allowed");
  if (error) return false;
  return data === true;
}

/**
 * 전체 초기화 시점(밀리초). 이 기기가 가진 사본이 이보다 오래되면 버려야 한다.
 * 기록이 없으면 0.
 */
export async function getResetAt(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from("mindmap_resets")
    .select("reset_at")
    .maybeSingle();
  if (error || !data) return 0;
  return Number((data as { reset_at: number }).reset_at);
}

export async function pullAll(): Promise<{
  folders: MindFolder[];
  maps: MindMap[];
  nodes: MindNode[];
}> {
  if (!supabase) return { folders: [], maps: [], nodes: [] };
  const [f, m, n] = await Promise.all([
    supabase.from("mindmap_folders").select("*"),
    supabase.from("mindmap_maps").select("*"),
    supabase.from("mindmap_nodes").select("*"),
  ]);
  if (f.error) throw f.error;
  if (m.error) throw m.error;
  if (n.error) throw n.error;
  return {
    folders: (f.data as FolderRow[]).map(rowToFolder),
    maps: (m.data as MapRow[]).map(rowToMap),
    nodes: (n.data as NodeRow[]).map(rowToNode),
  };
}

export async function pushRows(
  folders: MindFolder[],
  maps: MindMap[],
  nodes: MindNode[],
  userId: string,
) {
  if (!supabase) return;
  if (folders.length) {
    const { error } = await supabase
      .from("mindmap_folders")
      .upsert(folders.map((f) => folderToRow(f, userId)));
    if (error) throw error;
  }
  if (maps.length) {
    const { error } = await supabase
      .from("mindmap_maps")
      .upsert(maps.map((m) => mapToRow(m, userId)));
    if (error) throw error;
  }
  // 노드는 한 번에 너무 많이 보내지 않도록 나눠서 올린다
  for (let i = 0; i < nodes.length; i += 200) {
    const chunk = nodes.slice(i, i + 200).map((n) => nodeToRow(n, userId));
    const { error } = await supabase.from("mindmap_nodes").upsert(chunk);
    if (error) throw error;
  }
}

/** 영구 삭제. soft delete와 달리 행 자체를 없앤다. */
export async function deleteRows(folderIds: string[], mapIds: string[], nodeIds: string[]) {
  if (!supabase) return;
  if (folderIds.length) {
    const { error } = await supabase.from("mindmap_folders").delete().in("id", folderIds);
    if (error) throw error;
  }
  for (let i = 0; i < nodeIds.length; i += 200) {
    const { error } = await supabase
      .from("mindmap_nodes")
      .delete()
      .in("id", nodeIds.slice(i, i + 200));
    if (error) throw error;
  }
  for (let i = 0; i < mapIds.length; i += 200) {
    const { error } = await supabase
      .from("mindmap_maps")
      .delete()
      .in("id", mapIds.slice(i, i + 200));
    if (error) throw error;
  }
}
