import type { Edge, Node } from "@xyflow/react";
import type { MindNode } from "../types";

export type MindFlowNode = Node<{ node: MindNode; hasChildren: boolean }, "mind">;

const NODE_H = 42;
const CHAR_W = 8;
const GAP_X = 70; // 부모-자식 가로 간격
const GAP_Y = 14; // 형제 세로 간격

function estimateWidth(text: string) {
  const longest = text.split("\n").reduce((m, l) => Math.max(m, l.length), 0);
  return Math.min(260, Math.max(80, longest * CHAR_W + 30));
}

/**
 * parent_id 트리를 React Flow nodes/edges로 변환한다.
 * - 기본은 좌→우 자동 배치, 형제는 order 순서로 위→아래
 * - 노드에 x/y가 있으면 그 좌표를 쓰고, 자식들은 그 위치를 기준으로 매달린다
 *   (→ 부모를 옮기면 가지 전체가 따라 움직인다)
 * - 접힌 노드의 자손은 그리지 않는다
 */
export function layoutTree(
  all: MindNode[],
  mapId: string,
  edgeType: Edge["type"] = "smoothstep",
) {
  const live = all.filter((n) => n.mapId === mapId && !n.deletedAt);
  const byParent = new Map<string | null, MindNode[]>();
  for (const n of live) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.order - b.order);

  const visibleChildren = (n: MindNode) => (n.collapsed ? [] : (byParent.get(n.id) ?? []));

  // 1) 각 서브트리가 차지하는 세로 높이
  const subtreeH = new Map<string, number>();
  const measure = (n: MindNode): number => {
    const kids = visibleChildren(n);
    let h = NODE_H;
    if (kids.length) {
      h = Math.max(
        NODE_H,
        kids.reduce((sum, k) => sum + measure(k), 0) + GAP_Y * (kids.length - 1),
      );
    }
    subtreeH.set(n.id, h);
    return h;
  };

  // 2) 좌표 배치
  const nodes: MindFlowNode[] = [];
  const edges: Edge[] = [];

  const place = (n: MindNode, slotX: number, slotTop: number) => {
    const h = subtreeH.get(n.id)!;
    const w = estimateWidth(n.text || "새 노드");

    // 수동 좌표가 있으면 그것이 실제 위치가 된다
    const ex = n.x ?? slotX;
    const ey = n.y ?? slotTop + h / 2 - NODE_H / 2;

    nodes.push({
      id: n.id,
      type: "mind",
      position: { x: ex, y: ey },
      data: { node: n, hasChildren: (byParent.get(n.id)?.length ?? 0) > 0 },
      draggable: true,
    });

    const kids = visibleChildren(n);
    if (!kids.length) return;

    // 자식 묶음을 부모의 실제 위치 기준으로 세로 가운데 정렬
    const kidsH =
      kids.reduce((sum, k) => sum + subtreeH.get(k.id)!, 0) + GAP_Y * (kids.length - 1);
    let cy = ey + NODE_H / 2 - kidsH / 2;

    for (const k of kids) {
      edges.push({ id: `${n.id}-${k.id}`, source: n.id, target: k.id, type: edgeType });
      place(k, ex + w + GAP_X, cy);
      cy += subtreeH.get(k.id)! + GAP_Y;
    }
  };

  let top = 0;
  for (const root of byParent.get(null) ?? []) {
    measure(root);
    place(root, 0, top);
    top += subtreeH.get(root.id)! + GAP_Y * 3;
  }

  return { nodes, edges };
}
