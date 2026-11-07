export type ThemeId = "paper" | "midnight" | "note" | "modern-light" | "modern-dark";

export interface ThemeDef {
  id: ThemeId;
  name: string;
  /** React Flow 엣지 타입 — 테마의 선 모양 */
  edgeType: "default" | "straight" | "step" | "smoothstep";
  /** 사이드바 미리보기용 색 (배경, 노드, 강조) */
  swatch: [string, string, string];
}

export const THEMES: ThemeDef[] = [
  { id: "paper", name: "종이", edgeType: "default", swatch: ["#F3EFE5", "#FFFFFF", "#C4713F"] },
  { id: "midnight", name: "미드나이트", edgeType: "straight", swatch: ["#13141B", "#242734", "#6FE9C0"] },
  { id: "note", name: "노트", edgeType: "step", swatch: ["#FFFFFF", "#FFFFFF", "#151515"] },
  // Modern Axis — 제공받은 에셋 기준 (곡선 연결선, 둥근 카드, 왼쪽 색 띠)
  {
    id: "modern-light",
    name: "모던 라이트",
    edgeType: "default",
    swatch: ["#F5F7FB", "#FFFFFF", "#2563EB"],
  },
  {
    id: "modern-dark",
    name: "모던 다크",
    edgeType: "default",
    swatch: ["#0D1424", "#172237", "#78A5FF"],
  },
];

export const DEFAULT_THEME: ThemeId = "paper";

export function themeById(id: ThemeId): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
