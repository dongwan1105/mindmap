export interface MindNode {
  id: string;
  mapId: string;
  parentId: string | null;
  text: string;
  order: number;
  collapsed: boolean;
  color: string | null;
  /** 사용자가 직접 옮긴 좌표. null이면 자동 배치 */
  x: number | null;
  y: number | null;
  updatedAt: number;
  deletedAt: number | null;
}

export interface MindMap {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}
