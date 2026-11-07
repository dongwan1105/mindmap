export interface MindNode {
  id: string;
  mapId: string;
  parentId: string | null;
  text: string;
  order: number;
  collapsed: boolean;
  color: string | null;
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
