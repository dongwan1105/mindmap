export interface MindNode {
  id: string;
  mapId: string;
  parentId: string | null;
  text: string;
  order: number;
  collapsed: boolean;
  /** 글자색 */
  color: string | null;
  /** 카드 배경색 (연한 채움 + 테두리로 쓰인다) */
  bg: string | null;
  bold: boolean;
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
