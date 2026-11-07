export type ThemeId = "paper" | "midnight" | "note";

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
];

export const DEFAULT_THEME: ThemeId = "paper";

export function themeById(id: ThemeId): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
