import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type OnNodeDrag,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMapStore } from "../store/useMapStore";
import { layoutTree, type MindFlowNode } from "../layout/tree";
import MindNodeView from "./MindNodeView";

const nodeTypes = { mind: MindNodeView };

function CanvasInner() {
  const mapId = useMapStore((s) => s.currentMapId);
  const allNodes = useMapStore((s) => s.nodes);
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const editingNodeId = useMapStore((s) => s.editingNodeId);
  const { addChild, addSibling, deleteNode, toggleCollapse, startEditing, selectNode, moveNode } =
    useMapStore.getState();
  const { fitView, getIntersectingNodes } = useReactFlow();

  const { nodes, edges } = useMemo(
    () => (mapId ? layoutTree(allNodes, mapId) : { nodes: [], edges: [] }),
    [allNodes, mapId],
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
        default:
          // 글자를 바로 치면 편집 시작
          if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
            startEditing(selectedNodeId);
          }
      }
    };
    const navigate = (key: string) => {
      const cur = allNodes.find((n) => n.id === selectedNodeId);
      if (!cur) return;
      const live = allNodes.filter((n) => n.mapId === cur.mapId && !n.deletedAt);
      if (key === "ArrowLeft" && cur.parentId) selectNode(cur.parentId);
      if (key === "ArrowRight") {
        const kids = live.filter((n) => n.parentId === cur.id).sort((a, b) => a.order - b.order);
        if (kids[0]) {
          if (cur.collapsed) toggleCollapse(cur.id);
          selectNode(kids[0].id);
        }
      }
      if (key === "ArrowUp" || key === "ArrowDown") {
        const sibs = live
          .filter((n) => n.parentId === cur.parentId)
          .sort((a, b) => a.order - b.order);
        const i = sibs.findIndex((n) => n.id === cur.id);
        const next = sibs[key === "ArrowUp" ? i - 1 : i + 1];
        if (next) selectNode(next.id);
      }
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
  ]);

  // 드래그해서 다른 노드 위에 놓으면 그 노드의 자식으로 이동
  const onNodeDragStop: OnNodeDrag<MindFlowNode> = useCallback(
    (_e, node) => {
      const hit = getIntersectingNodes(node).find((n) => n.id !== node.id);
      if (hit) moveNode(node.id, hit.id);
      else {
        // 레이아웃 재계산을 강제하기 위해 상태를 한 번 건드림
        useMapStore.setState((s) => ({ nodes: [...s.nodes] }));
      }
    },
    [getIntersectingNodes, moveNode],
  );

  if (!mapId) {
    return <div className="canvas__empty">왼쪽에서 마인드맵을 만들어 시작하세요</div>;
  }

  return (
    <ReactFlow<MindFlowNode>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onPaneClick={() => {
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
