import { useState } from "react";
import { useMapStore } from "../store/useMapStore";
import { CARD_COLORS, TEXT_COLORS } from "../palette";

type Target = "text" | "card";

/**
 * 선택한 카드의 모양을 바꾸는 바.
 * 카드에 붙여 두면 바로 위/아래 카드를 가려 누를 수 없게 되므로 캔버스 아래에 띄운다.
 */
export default function StyleBar() {
  const [target, setTarget] = useState<Target>("text");
  const selectedId = useMapStore((s) => s.selectedNodeId);
  const editing = useMapStore((s) => s.editingNodeId);
  const nodes = useMapStore((s) => s.nodes);
  const setNodeStyle = useMapStore((s) => s.setNodeStyle);
  const arrangeChildren = useMapStore((s) => s.arrangeChildren);

  const node = selectedId ? nodes.find((n) => n.id === selectedId && !n.deletedAt) : undefined;
  if (!node || editing) return null;

  const colors = target === "text" ? TEXT_COLORS : CARD_COLORS;
  const current = target === "text" ? node.color : node.bg;

  // 하위 카드 중 직접 옮긴 것이 있을 때만 정렬 버튼을 쓸 수 있게
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
    <div className="stylebar">
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

      <button
        className="stylebar__arrange"
        disabled={!movedBelow}
        title="이 카드의 하위 카드들을 자동 배치로 되돌립니다"
        onClick={() => arrangeChildren(node.id)}
      >
        하위 정렬
      </button>
    </div>
  );
}
