import type { Edge, Node } from "@xyflow/react";
import type { MindNode } from "../types";

export type MindFlowNode = Node<
  { node: MindNode; hasChildren: boolean; dir: Dir },
  "mind"
>;

const NODE_H = 42;
const CHAR_W = 8;
const GAP_X = 70; // 부모-자식 가로 간격
const GAP_Y = 14; // 형제 세로 간격

export type Dir = "left" | "right";

function estimateWidth(text: string) {
  const longest = text.split("\n").reduce((m, l) => Math.max(m, l.length), 0);
  return Math.min(260, Math.max(80, longest * CHAR_W + 30));
}

/**
 * parent_id 트리를 React Flow nodes/edges로 변환한다.
 *
 * - 기본은 좌→우 자동 배치, 형제는 order 순서로 위→아래
 * - 카드를 부모보다 왼쪽에 놓으면 그 가지는 **왼쪽으로** 뻗는다.
 *   하위 카드도 같은 방향을 물려받아 한 가지가 좌우로 꺾이지 않는다.
 * - 연결선은 항상 서로 마주보는 면에 붙는다 (뒤로 돌아가지 않게)
 * - 접힌 카드의 자손은 그리지 않는다
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

  /**
   * anchorX = 이 카드가 뻗어 나가기 시작하는 x.
   * 오른쪽 가지면 카드의 왼쪽 모서리, 왼쪽 가지면 오른쪽 모서리가 된다.
   */
  const place = (n: MindNode, anchorX: number, slotTop: number, dir: Dir) => {
    const h = subtreeH.get(n.id)!;
    const w = estimateWidth(n.text || "새 노드");

    // 직접 옮긴 카드는 저장된 좌표가 실제 위치
    const ex = n.x ?? (dir === "right" ? anchorX : anchorX - w);
    const ey = n.y ?? slotTop + h / 2 - NODE_H / 2;

    nodes.push({
      id: n.id,
      type: "mind",
      position: { x: ex, y: ey },
      data: { node: n, hasChildren: (byParent.get(n.id)?.length ?? 0) > 0, dir },
      draggable: true,
    });

    const kids = visibleChildren(n);
    if (!kids.length) return;

    const kidsH =
      kids.reduce((sum, k) => sum + subtreeH.get(k.id)!, 0) + GAP_Y * (kids.length - 1);
    let cy = ey + NODE_H / 2 - kidsH / 2;

    for (const k of kids) {
      const kw = estimateWidth(k.text || "새 노드");
      // 직접 옮긴 카드는 부모와의 좌우 관계로 방향이 정해지고, 아니면 부모 방향을 물려받는다
      const kDir: Dir =
        k.x !== null ? (k.x + kw / 2 < ex + w / 2 ? "left" : "right") : dir;

      const kAnchor = kDir === "right" ? ex + w + GAP_X : ex - GAP_X;
      place(k, kAnchor, cy, kDir);

      // 연결선은 서로 마주보는 면에 붙인다
      edges.push({
        id: `${n.id}-${k.id}`,
        source: n.id,
        target: k.id,
        type: edgeType,
        sourceHandle: kDir === "right" ? "sr" : "sl",
        targetHandle: kDir === "right" ? "tl" : "tr",
      });

      cy += subtreeH.get(k.id)! + GAP_Y;
    }
  };

  let top = 0;
  for (const root of byParent.get(null) ?? []) {
    measure(root);
    place(root, root.x ?? 0, top, "right");
    top += subtreeH.get(root.id)! + GAP_Y * 3;
  }

  return { nodes, edges };
}
