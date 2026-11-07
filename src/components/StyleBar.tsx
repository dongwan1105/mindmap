import { useState } from "react";
import { useInternalNode, useViewport } from "@xyflow/react";
import { useMapStore } from "../store/useMapStore";
import { CARD_COLORS, TEXT_COLORS } from "../palette";

type Target = "text" | "card";

const BAR_H = 40; // 바 높이(대략) — 위에 자리가 없으면 아래로 뒤집는 기준

/**
 * 선택한 카드의 모양을 바꾸는 바. 카드 바로 위에 붙는다.
 *
 * 형제 카드 간격이 좁아서 바가 이웃 카드를 덮게 되는데,
 * 바탕은 클릭을 통과시키고 버튼에서만 받도록 해 두었다.
 * 카드가 화면 위쪽에 붙어 있으면 아래로 뒤집는다.
 */
export default function StyleBar() {
  const [target, setTarget] = useState<Target>("text");
  const selectedId = useMapStore((s) => s.selectedNodeId);
  const editing = useMapStore((s) => s.editingNodeId);
  const barOpen = useMapStore((s) => s.barOpen);
  const nodes = useMapStore((s) => s.nodes);
  const setNodeStyle = useMapStore((s) => s.setNodeStyle);
  const arrangeChildren = useMapStore((s) => s.arrangeChildren);

  const { x: vx, y: vy, zoom } = useViewport();
  // 크기가 실제로 측정된 뒤에 위치를 잡아야 카드 가운데에 정확히 붙는다
  const flowNode = useInternalNode(selectedId ?? "");

  const node = selectedId ? nodes.find((n) => n.id === selectedId && !n.deletedAt) : undefined;
  const w = flowNode?.measured?.width;
  const h = flowNode?.measured?.height;
  if (!node || !flowNode || editing || !barOpen || !w || !h) return null;

  const pos = flowNode.internals.positionAbsolute;
  const centerX = (pos.x + w / 2) * zoom + vx;
  const topY = pos.y * zoom + vy;
  const bottomY = (pos.y + h) * zoom + vy;

  // 위에 자리가 없으면 카드 아래로
  const below = topY < BAR_H + 24;
  const style = below
    ? { left: centerX, top: bottomY + 10, transform: "translateX(-50%)" }
    : { left: centerX, top: topY - 10, transform: "translate(-50%, -100%)" };

  const colors = target === "text" ? TEXT_COLORS : CARD_COLORS;
  const current = target === "text" ? node.color : node.bg;

  const movedBelow = (() => {
    const ids = new Set<string>();
    let frontier = [node.id];
    while (frontier.length) {
      const next: string[] = [];
      for (const n of nodes) {
        if (!n.deletedAt && n.parentId && frontier.includes(n.parentId) && !ids.has(n.id)) {
          ids.add(n.id);
          next.push(n.id);
        }
      }
      frontier = next;
    }
    return [...ids].some((id) => nodes.find((n) => n.id === id)?.x !== null);
  })();

  return (
    <div className="stylebar" style={style}>
      <div className="stylebar__tabs">
        {(["text", "card"] as Target[]).map((t) => (
          <button
            key={t}
            className={`stylebar__tab${target === t ? " stylebar__tab--on" : ""}`}
            onClick={() => setTarget(t)}
          >
            {t === "text" ? "글자" : "카드"}
          </button>
        ))}
      </div>

      {colors.map((c) => (
        <button
          key={c.label}
          className={`swatch${current === c.value ? " swatch--on" : ""}${
            c.value === null ? " swatch--none" : ""
          }`}
          style={c.value ? { background: c.value } : undefined}
          title={c.label}
          aria-label={`${target === "text" ? "글자색" : "카드색"} ${c.label}`}
          onClick={() =>
            setNodeStyle(node.id, target === "text" ? { color: c.value } : { bg: c.value })
          }
        />
      ))}

      <span className="stylebar__sep" />

      <button
        className={`bold-btn${node.bold ? " bold-btn--on" : ""}`}
        title="굵게 (Ctrl+B)"
        aria-label="굵게"
        onClick={() => setNodeStyle(node.id, { bold: !node.bold })}
      >
        B
      </button>

      {movedBelow && (
        <button
          className="stylebar__arrange"
          title="이 카드의 하위 카드들을 자동 배치로 되돌립니다"
          onClick={() => arrangeChildren(node.id)}
        >
          하위 정렬
        </button>
      )}
    </div>
  );
}
