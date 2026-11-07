/** 카드 글자색. 밝은 배경과 어두운 배경 모두에서 읽히는 톤. */
export const TEXT_COLORS: { value: string | null; label: string }[] = [
  { value: null, label: "기본" },
  { value: "#EF6B5A", label: "빨강" },
  { value: "#F0A032", label: "주황" },
  { value: "#45B06A", label: "초록" },
  { value: "#4D96E0", label: "파랑" },
  { value: "#A78BFA", label: "보라" },
];

/**
 * 카드 배경색. 고른 색을 그대로 칠하지 않고
 * 연하게 깐 뒤 같은 색 테두리를 두른다 (아래 cardStyle 참고).
 * 그래야 밝은 테마와 어두운 테마 양쪽에서 글자가 읽힌다.
 */
export const CARD_COLORS: { value: string | null; label: string }[] = [
  { value: null, label: "기본" },
  { value: "#EF6B5A", label: "빨강" },
  { value: "#F0A032", label: "주황" },
  { value: "#45B06A", label: "초록" },
  { value: "#4D96E0", label: "파랑" },
  { value: "#A78BFA", label: "보라" },
];

/** 카드에 적용할 배경/테두리. 색이 없으면 테마 기본값을 그대로 쓴다. */
export function cardStyle(bg: string | null) {
  if (!bg) return undefined;
  return { background: `${bg}26`, borderColor: bg };
}
