import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyNodeChanges,
  useStore,
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type OnNodeDrag,
  type OnNodesChange,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMapStore } from "../store/useMapStore";
import { layoutTree, type MindFlowNode, type NodeSizes } from "../layout/tree";
import { themeById } from "../themes";
import MindNodeView from "./MindNodeView";
import StyleBar from "./StyleBar";

const nodeTypes = { mind: MindNodeView };

function CanvasInner() {
  const mapId = useMapStore((s) => s.currentMapId);
  const allNodes = useMapStore((s) => s.nodes);
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const editingNodeId = useMapStore((s) => s.editingNodeId);
  const theme = useMapStore((s) => s.theme);
  const {
    addChild,
    addSibling,
    deleteNode,
    toggleCollapse,
    startEditing,
    selectNode,
    moveNode,
    setNodePosition,
  } = useMapStore.getState();
  const { fitView, getIntersectingNodes } = useReactFlow();

  const edgeType = themeById(theme).edgeType;

  /*
   * 카드의 실제 크기를 받아 배치에 쓴다.
   * 글자 수로 폭을 추정하면 한글에서 크게 빗나가서 카드끼리 붙어 버린다.
   * 문자열 키로 받아 크기가 실제로 바뀔 때만 다시 계산되게 한다(되먹임 방지).
   */
  const sizeKey = useStore((s) => {
    const parts: string[] = [];
    s.nodeLookup.forEach((n, id) =>
      parts.push(`${id}:${Math.round(n.measured?.width ?? 0)}x${Math.round(n.measured?.height ?? 0)}`),
    );
    return parts.sort().join("|");
  });
  const sizes = useMemo<NodeSizes>(() => {
    const m: NodeSizes = new Map();
    for (const part of sizeKey.split("|")) {
      if (!part) continue;
      const [id, wh] = part.split(":");
      const [w, h] = wh.split("x").map(Number);
      if (w > 0 && h > 0) m.set(id, { w, h });
    }
    return m;
  }, [sizeKey]);

  const layout = useMemo(
    () => (mapId ? layoutTree(allNodes, mapId, edgeType, sizes) : { nodes: [], edges: [] }),
    [allNodes, mapId, edgeType, sizes],
  );
  const edges = layout.edges;

  // 드래그 중에는 React Flow가 위치를 직접 움직여야 하므로 로컬 상태를 둔다.
  // 저장된 트리가 바뀌면 다시 계산된 레이아웃으로 맞춘다.
  const [nodes, setNodes] = useState(layout.nodes);
  useEffect(() => {
    // 새 배치를 넣을 때 이미 잰 크기를 그대로 들고 간다.
    // 지워 버리면 React Flow가 "아직 안 잰 카드"로 보고 숨기고,
    // 그 상태가 다시 배치를 바꿔 되먹임 고리가 생긴다.
    setNodes((prev) => {
      const measured = new Map(prev.map((n) => [n.id, n.measured]));
      return layout.nodes.map((n) => {
        const m = measured.get(n.id);
        return m ? { ...n, measured: m } : n;
      });
    });
  }, [layout.nodes]);
  const onNodesChange: OnNodesChange<MindFlowNode> = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  // 맵이 바뀌면 전체 보기
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 200, maxZoom: 1 }), 30);
    return () => clearTimeout(t);
  }, [mapId, fitView]);

  // 전역 키보드 단축키 (편집 중이 아닐 때만)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingNodeId) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (!selectedNodeId) return;

      switch (e.key) {
        case "Tab":
          e.preventDefault();
          addChild(selectedNodeId);
          break;
        case "Enter":
          e.preventDefault();
          if (addSibling(selectedNodeId) === null) addChild(selectedNodeId);
          break;
        case "F2":
          e.preventDefault();
          startEditing(selectedNodeId);
          break;
        case " ":
          e.preventDefault();
          toggleCollapse(selectedNodeId);
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          deleteNode(selectedNodeId);
          break;
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown":
          e.preventDefault();
          navigate(e.key);
          break;
        default: {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
            e.preventDefault();
            const n = useMapStore.getState().nodes.find((x) => x.id === selectedNodeId);
            if (n) useMapStore.getState().setNodeStyle(selectedNodeId, { bold: !n.bold });
            break;
          }
          if (e.metaKey || e.ctrlKey || e.altKey) break;
          // 한글/일본어 IME는 조합 중 key가 "Process"(keyCode 229)로 들어온다.
          // 이 경우 첫 글자는 넘겨받을 수 없으므로 빈 상태로 편집만 시작한다.
          const composing = e.isComposing || e.key === "Process" || e.keyCode === 229;
          if (composing) {
            startEditing(selectedNodeId, "");
          } else if (e.key.length === 1) {
            e.preventDefault();
            startEditing(selectedNodeId, e.key);
          }
          break;
        }
      }
    };
    const navigate = (key: string) => {
      const cur = allNodes.find((n) => n.id === selectedNodeId);
      if (!cur) return;
      const live = allNodes.filter((n) => n.mapId === cur.mapId && !n.deletedAt);

      // 배치된 방향. 아직 그려지지 않은(접힌) 자식은 부모 방향을 따른다.
      const dirOf = (id: string, fallback: "left" | "right" = "right") =>
        nodes.find((n) => n.id === id)?.data.dir ?? fallback;
      const myDir = dirOf(cur.id);

      if (key === "ArrowUp" || key === "ArrowDown") {
        const sibs = live
          .filter((n) => n.parentId === cur.parentId)
          .sort((a, b) => a.order - b.order);
        const i = sibs.findIndex((n) => n.id === cur.id);
        const next = sibs[key === "ArrowUp" ? i - 1 : i + 1];
        if (next) selectNode(next.id);
        return;
      }

      const kids = live
        .filter((n) => n.parentId === cur.id)
        .sort((a, b) => a.order - b.order);
      const side = key === "ArrowLeft" ? "left" : "right";
      const towardChild = kids.filter((k) => dirOf(k.id, myDir) === side);

      if (towardChild[0]) {
        if (cur.collapsed) toggleCollapse(cur.id);
        selectNode(towardChild[0].id);
        return;
      }
      // 그 방향에 자식이 없으면 부모 쪽으로 (부모는 가지의 반대편에 있다)
      if (myDir !== side && cur.parentId) selectNode(cur.parentId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedNodeId,
    editingNodeId,
    allNodes,
    addChild,
    addSibling,
    deleteNode,
    toggleCollapse,
    startEditing,
    selectNode,
    nodes,
  ]);

  // 드래그해서 다른 노드 위에 놓으면 그 노드의 자식으로 이동
  const onNodeDragStop: OnNodeDrag<MindFlowNode> = useCallback(
    (_e, node) => {
      const hit = getIntersectingNodes(node).find((n) => n.id !== node.id);
      if (hit) moveNode(node.id, hit.id);
      else setNodePosition(node.id, node.position.x, node.position.y);
    },
    [getIntersectingNodes, moveNode, setNodePosition],
  );

  if (!mapId) {
    return <div className="canvas__empty">왼쪽에서 마인드맵을 만들어 시작하세요</div>;
  }

  return (
    <>
    <ReactFlow<MindFlowNode>
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      onPointerDownCapture={(e) => {
        // 빈 곳을 누르는 순간 선택을 푼다.
        // onPaneClick만 쓰면 눌렀다 뗀 자리가 같을 때만 불려서,
        // 화면을 끌어 옮기면 편집 바가 그대로 남아 있었다.
        const el = e.target as HTMLElement;
        if (el.closest(".mind-node") || el.closest(".react-flow__controls")) return;

        /*
         * 편집 바는 버튼 사이 빈 틈으로 클릭이 통과한다(뒤 카드를 누를 수 있게).
         * 그래서 색 버튼을 살짝 빗맞히면 "빈 곳"으로 처리돼 바가 닫혀 버렸다.
         * 요소가 아니라 바가 차지한 영역으로 판단한다.
         */
        const bar = document.querySelector(".stylebar");
        if (bar) {
          const r = bar.getBoundingClientRect();
          const inBar =
            e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (inBar) return;
        }

        selectNode(null);
        startEditing(null);
      }}
      onNodeDragStop={onNodeDragStop}
      nodesConnectable={false}
      nodesFocusable={false}
      selectNodesOnDrag={false}
      deleteKeyCode={null}
      selectionKeyCode={null}
      multiSelectionKeyCode={null}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
    <StyleBar />
    </>
  );
}

export default function Canvas() {
  return (
    <div className="canvas">
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </div>
  );
}
