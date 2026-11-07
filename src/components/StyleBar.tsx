import { useMapStore } from "../store/useMapStore";
import { TEXT_COLORS } from "../palette";

/**
 * 선택한 카드의 글자 스타일 바.
 * 카드에 붙여 두면 바로 위/아래 카드를 가려서 누를 수 없게 되므로,
 * 캔버스 아래쪽에 띄워 둔다.
 */
export default function StyleBar() {
  const selectedId = useMapStore((s) => s.selectedNodeId);
  const editing = useMapStore((s) => s.editingNodeId);
  const nodes = useMapStore((s) => s.nodes);
  const setNodeStyle = useMapStore((s) => s.setNodeStyle);

  const node = selectedId ? nodes.find((n) => n.id === selectedId && !n.deletedAt) : undefined;
  if (!node || editing) return null;

  return (
    <div className="stylebar">
      {TEXT_COLORS.map((c) => (
        <button
          key={c.label}
          className={`swatch${node.color === c.value ? " swatch--on" : ""}${
            c.value === null ? " swatch--none" : ""
          }`}
          style={c.value ? { background: c.value } : undefined}
          title={c.label}
          aria-label={`글자색 ${c.label}`}
          onClick={() => setNodeStyle(node.id, { color: c.value })}
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
    </div>
  );
}
