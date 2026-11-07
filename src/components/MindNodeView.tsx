import { memo, useLayoutEffect, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useMapStore } from "../store/useMapStore";
import { cardStyle } from "../palette";
import type { MindFlowNode } from "../layout/tree";

/**
 * 카드 하나의 외관.
 * 모양·색은 theme.css 변수와 index.css의 .mind-node 규칙이 결정한다.
 */
function MindNodeView({ id, data }: NodeProps<MindFlowNode>) {
  const { node, hasChildren, dir } = data;
  const isRoot = node.parentId === null;
  const selected = useMapStore((s) => s.selectedNodeId === id);
  const editing = useMapStore((s) => s.editingNodeId === id);
  const selectNode = useMapStore((s) => s.selectNode);
  const startEditing = useMapStore((s) => s.startEditing);
  const updateNodeText = useMapStore((s) => s.updateNodeText);
  const toggleCollapse = useMapStore((s) => s.toggleCollapse);
  const deleteNode = useMapStore((s) => s.deleteNode);
  const addChild = useMapStore((s) => s.addChild);
  const setNodeStyle = useMapStore((s) => s.setNodeStyle);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef(node.text);

  useLayoutEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    // 글자를 눌러 편집을 시작했다면 그 글자로 시작한다 (첫 글자가 사라지지 않게)
    const initial = useMapStore.getState().editingInitial;
    const start = initial ?? node.text;
    draftRef.current = start;
    el.value = start;
    el.focus();
    if (initial === null) el.select();
    else el.setSelectionRange(start.length, start.length);
    autosize(el);
    // React Flow가 포커스를 가져가는 경우를 위한 보정.
    // 값은 절대 다시 쓰지 않는다 — 이미 입력된 글자가 지워지기 때문.
    const t = setTimeout(() => {
      const again = inputRef.current;
      if (again && document.activeElement !== again) again.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [editing]);

  /**
   * 편집을 마친다. 내용이 비어 있어도 카드를 지우지 않는다.
   * (포커스가 풀리는 상황 — 폰에서 키보드가 바뀔 때 등 — 에 만든 카드가
   *  소리 없이 사라지면 안 되기 때문. 지우려면 Esc나 Del을 쓴다.)
   */
  const commit = () => {
    const text = draftRef.current.trim();
    if (isRoot && text === "") {
      startEditing(null); // 루트는 비울 수 없다
      return;
    }
    if (text !== node.text) updateNodeText(id, text);
    startEditing(null);
  };

  /** Esc: 방금 만든 빈 카드면 없던 일로, 아니면 고치던 내용만 되돌린다. */
  const cancel = () => {
    if (!isRoot && node.text === "" && draftRef.current.trim() === "") {
      deleteNode(id);
      startEditing(null);
      return;
    }
    draftRef.current = node.text;
    startEditing(null);
  };

  const cls = [
    "mind-node",
    isRoot && "mind-node--root",
    selected && "mind-node--selected",
    node.x !== null && "mind-node--pinned",
  ]
    .filter(Boolean)
    .join(" ");

  const style = {
    color: node.color ?? undefined,
    fontWeight: node.bold ? 700 : undefined,
    ...cardStyle(node.bg),
  };

  return (
    <div
      className={cls}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        // 폰에서는 이미 고른 카드를 한 번 더 탭하면 바로 편집된다.
        // (더블탭은 확대와 겹쳐서 잘 안 먹는다)
        if (selected && !editing && isTouchDevice()) startEditing(id);
        else selectNode(id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        startEditing(id);
      }}
    >
      {/* 좌우 양쪽에 연결점을 둔다. 어느 쪽을 쓸지는 레이아웃이 정한다. */}
      <Handle type="target" position={Position.Left} id="tl" />
      <Handle type="target" position={Position.Right} id="tr" />

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
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
              e.preventDefault();
              setNodeStyle(id, { bold: !node.bold });
            } else if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            } else if (e.key === "Tab") {
              e.preventDefault();
              commit();
              addChild(id);
            }
          }}
        />
      ) : (
        <span>{node.text || "새 노드"}</span>
      )}

      <Handle type="source" position={Position.Left} id="sl" />
      <Handle type="source" position={Position.Right} id="sr" />

      {hasChildren && (
        <button
          className={`mind-node__toggle nodrag${dir === "left" ? " mind-node__toggle--left" : ""}`}
          title={node.collapsed ? "펼치기" : "접기"}
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse(id);
          }}
        >
          {node.collapsed ? "+" : "–"}
        </button>
      )}

      <button
        className={`mind-node__add nodrag${dir === "left" ? " mind-node__add--left" : ""}`}
        title="하위 카드 추가 (Tab)"
        onClick={(e) => {
          e.stopPropagation();
          addChild(id);
        }}
      >
        +
      </button>
    </div>
  );
}

/** 손가락으로 쓰는 기기인지 (마우스 환경에서는 한 번 탭 = 편집을 쓰지 않는다) */
function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

function autosize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export default memo(MindNodeView);
