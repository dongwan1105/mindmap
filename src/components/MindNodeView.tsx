import { memo, useEffect, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useMapStore } from "../store/useMapStore";
import type { MindFlowNode } from "../layout/tree";

/**
 * 노드 하나의 외관. 모양/색은 index.css의 .mind-node 규칙과
 * theme.css 변수로 제어한다. 여기엔 로직만 최소한으로.
 */
function MindNodeView({ id, data }: NodeProps<MindFlowNode>) {
  const { node, hasChildren } = data;
  const isRoot = node.parentId === null;
  const selected = useMapStore((s) => s.selectedNodeId === id);
  const editing = useMapStore((s) => s.editingNodeId === id);
  const selectNode = useMapStore((s) => s.selectNode);
  const startEditing = useMapStore((s) => s.startEditing);
  const updateNodeText = useMapStore((s) => s.updateNodeText);
  const toggleCollapse = useMapStore((s) => s.toggleCollapse);
  const deleteNode = useMapStore((s) => s.deleteNode);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef(node.text);

  useEffect(() => {
    if (!editing) return;
    draftRef.current = node.text;
    // React Flow가 노드 래퍼에 포커스를 주는 것보다 뒤에 실행되도록 한 프레임 미룬다
    const focus = () => {
      const el = inputRef.current;
      if (!el || document.activeElement === el) return;
      el.value = node.text;
      el.focus();
      el.select();
      autosize(el);
    };
    focus();
    const t = setTimeout(focus, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commit = () => {
    const text = draftRef.current.trim();
    if (text === "" && !isRoot) {
      deleteNode(id);
    } else if (text !== node.text) {
      updateNodeText(id, text || node.text);
    }
    startEditing(null);
  };

  const cls = [
    "mind-node",
    isRoot && "mind-node--root",
    selected && "mind-node--selected",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cls}
      style={node.color ? { borderColor: node.color } : undefined}
      onClick={(e) => {
        e.stopPropagation();
        selectNode(id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        startEditing(id);
      }}
    >
      <Handle type="target" position={Position.Left} />
      {editing ? (
        <textarea
          ref={inputRef}
          className="mind-node__input nodrag nowheel"
          rows={1}
          defaultValue={node.text}
          onChange={(e) => {
            draftRef.current = e.target.value;
            autosize(e.target);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              draftRef.current = node.text;
              commit();
            } else if (e.key === "Tab") {
              e.preventDefault();
              commit();
              useMapStore.getState().addChild(id);
            }
          }}
        />
      ) : (
        <span>{node.text || "새 노드"}</span>
      )}
      <Handle type="source" position={Position.Right} />
      {hasChildren && (
        <button
          className="mind-node__toggle nodrag"
          title={node.collapsed ? "펼치기" : "접기"}
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse(id);
          }}
        >
          {node.collapsed ? "+" : "–"}
        </button>
      )}
    </div>
  );
}

function autosize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export default memo(MindNodeView);
