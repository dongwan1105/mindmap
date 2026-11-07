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

/** 색을 어둡게 (검정 쪽으로 섞는다) */
function darken(hex: string, amount: number) {
  const part = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(c * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${part(0)}${part(1)}${part(2)}`;
}

/**
 * 카드에 적용할 배경/테두리. 색이 없으면 테마 기본값을 그대로 쓴다.
 *
 * 보통 카드는 색을 연하게 깔고 같은 색 테두리를 둘러, 밝은 테마와 어두운 테마
 * 양쪽에서 글자가 읽히게 한다. 하지만 루트는 원래 짙은 바탕에 밝은 글자라
 * 연하게 깔면 글자가 묻힌다. 그래서 루트만 색을 꽉 채우고 글자색도 맞춰 준다.
 */
export function cardStyle(bg: string | null, isRoot = false) {
  if (!bg) return undefined;
  if (!isRoot) return { background: `${bg}26`, borderColor: bg };
  // 팔레트 색을 그대로 깔면 흰 글자가 흐려진다(특히 주황·보라).
  // 진하게 깔아 대비를 확보하면서 루트 특유의 묵직한 느낌도 지킨다.
  const deep = darken(bg, 0.42);
  return { background: deep, borderColor: deep, color: "#FFFFFF" };
}
