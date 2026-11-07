import type { Edge, Node } from "@xyflow/react";
import type { MindNode } from "../types";

export type MindFlowNode = Node<{ node: MindNode; hasChildren: boolean }, "mind">;

const NODE_H = 40;
const CHAR_W = 8;
const GAP_X = 70; // 부모-자식 가로 간격
const GAP_Y = 14; // 형제 세로 간격

function estimateWidth(text: string) {
  const longest = text.split("\n").reduce((m, l) => Math.max(m, l.length), 0);
  return Math.min(260, Math.max(80, longest * CHAR_W + 28));
}

/**
 * 저장된 트리(parent_id 기반)를 React Flow nodes/edges로 변환하고
 * 좌→우 트리 레이아웃으로 배치한다. 형제는 order 순서로 위→아래.
 * 접힌 노드의 자손은 그리지 않는다.
 */
export function layoutTree(all: MindNode[], mapId: string) {
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
      h = kids.reduce((sum, k) => sum + measure(k), 0) + GAP_Y * (kids.length - 1);
      h = Math.max(h, NODE_H);
    }
    subtreeH.set(n.id, h);
    return h;
  };

  // 2) 좌표 배치
  const nodes: MindFlowNode[] = [];
  const edges: Edge[] = [];
  const place = (n: MindNode, x: number, top: number) => {
    const h = subtreeH.get(n.id)!;
    const w = estimateWidth(n.text || "새 노드");
    nodes.push({
      id: n.id,
      type: "mind",
      position: { x, y: top + h / 2 - NODE_H / 2 },
      data: { node: n, hasChildren: (byParent.get(n.id)?.length ?? 0) > 0 },
      draggable: n.parentId !== null,
    });
    let cy = top;
    for (const k of visibleChildren(n)) {
      edges.push({ id: `${n.id}-${k.id}`, source: n.id, target: k.id, type: "smoothstep" });
      place(k, x + w + GAP_X, cy);
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
