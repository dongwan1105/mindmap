import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useMapStore } from "../store/useMapStore";
import { THEMES } from "../themes";
import { signOut, type SyncStatus } from "../sync/useSync";
import { trashEntries } from "./Trash";
import type { MindFolder, MindMap } from "../types";

const SYNC_LABEL: Record<SyncStatus, string> = {
  idle: "로컬 전용",
  syncing: "동기화 중…",
  synced: "동기화됨",
  error: "동기화 실패",
};

/** 목록에 그릴 한 줄. 폴더 머리글과 맵이 한 흐름으로 섞인다. */
type Row =
  | { kind: "folder"; id: string; folder: MindFolder }
  | { kind: "map"; id: string; map: MindMap; inFolder: string | null };

export default function Sidebar({
  email,
  syncStatus,
  onNavigate,
}: {
  email: string | null;
  syncStatus: SyncStatus;
  onNavigate?: () => void;
}) {
  const allFolders = useMapStore((s) => s.folders);
  const allMaps = useMapStore((s) => s.maps);
  const allNodes = useMapStore((s) => s.nodes);
  const currentMapId = useMapStore((s) => s.currentMapId);
  const theme = useMapStore((s) => s.theme);
  const hasPinned = useMapStore((s) =>
    s.nodes.some((n) => n.mapId === s.currentMapId && !n.deletedAt && n.x !== null),
  );
  const trashCount = trashEntries(allMaps, allNodes).length;
  const {
    createMap,
    deleteMap,
    renameMap,
    selectMap,
    setTheme,
    resetPositions,
    setTrashOpen,
    createFolder,
    renameFolder,
    deleteFolder,
    toggleFolder,
    moveMapToFolder,
  } = useMapStore.getState();

  const folders = allFolders
    .filter((f) => !f.deletedAt)
    .sort((a, b) => a.order - b.order || b.updatedAt - a.updatedAt);
  const maps = allMaps.filter((m) => !m.deletedAt);
  const mapsIn = (folderId: string | null) =>
    maps
      .filter((m) => m.folderId === folderId)
      .sort((a, b) => a.order - b.order || b.updatedAt - a.updatedAt);

  const rows: Row[] = [];
  for (const f of folders) {
    rows.push({ kind: "folder", id: `f:${f.id}`, folder: f });
    if (!f.collapsed) {
      for (const m of mapsIn(f.id)) rows.push({ kind: "map", id: m.id, map: m, inFolder: f.id });
    }
  }
  for (const m of mapsIn(null)) rows.push({ kind: "map", id: m.id, map: m, inFolder: null });

  // ---------- 이름 수정 ----------
  const [editing, setEditing] = useState<{ kind: "map" | "folder"; id: string } | null>(null);
  const [draft, setDraft] = useState("");

  const commitName = () => {
    if (!editing) return;
    const name = draft.trim();
    if (name) {
      if (editing.kind === "map") renameMap(editing.id, name);
      else renameFolder(editing.id, name);
    }
    setEditing(null);
  };

  // ---------- 드래그로 옮기기 ----------
  const listRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | null>(null);
  const drag = useRef<{ startY: number; startTop: number } | null>(null);
  const [dropAt, setDropAt] = useState<{ folderId: string | null; before: string | null } | null>(
    null,
  );
  const [dropFolder, setDropFolder] = useState<string | null>(null);

  const rowEl = (key: string) =>
    listRef.current?.querySelector<HTMLElement>(`[data-row="${key}"]`) ?? null;

  const onMove = useCallback((e: PointerEvent) => {
    const id = dragging.current;
    const list = listRef.current;
    if (!id || !list || !drag.current) return;

    const el = rowEl(id);
    if (el) {
      const base = list.getBoundingClientRect().top - list.scrollTop - list.offsetTop;
      el.style.transform = `translateY(${
        drag.current.startTop + (e.clientY - drag.current.startY) - (base + el.offsetTop)
      }px)`;
    }

    // 폴더 머리글 위면 그 안으로, 아니면 어떤 줄 앞에 놓을지 계산한다
    const items = Array.from(list.querySelectorAll<HTMLElement>("[data-row]"));
    const base = list.getBoundingClientRect().top - list.scrollTop - list.offsetTop;
    let overFolder: string | null = null;
    let target: { folderId: string | null; before: string | null } | null = null;

    for (const item of items) {
      const key = item.dataset.row!;
      if (key === id) continue;
      const top = base + item.offsetTop;
      const h = item.offsetHeight;
      if (e.clientY < top || e.clientY > top + h) continue;
      if (key.startsWith("f:")) {
        overFolder = key.slice(2);
      } else {
        const row = rows.find((r) => r.id === key);
        if (row?.kind === "map") {
          target =
            e.clientY < top + h / 2
              ? { folderId: row.inFolder, before: row.map.id }
              : { folderId: row.inFolder, before: null };
        }
      }
      break;
    }
    if (!overFolder && !target) target = { folderId: null, before: null }; // 빈 곳 = 폴더 밖
    setDropFolder(overFolder);
    setDropAt(overFolder ? null : target);
  }, [rows]);

  const onUp = useCallback(() => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    const id = dragging.current;
    if (id) {
      const el = rowEl(id);
      if (el) el.style.transform = "";
      const folder = dropFolderRef.current;
      const at = dropAtRef.current;
      if (folder) moveMapToFolder(id, folder, null);
      else if (at) moveMapToFolder(id, at.folderId, at.before);
    }
    dragging.current = null;
    drag.current = null;
    setDropFolder(null);
    setDropAt(null);
  }, [onMove, moveMapToFolder]);

  // 창 핸들러에서 읽기 위한 거울
  const dropFolderRef = useRef<string | null>(null);
  const dropAtRef = useRef<{ folderId: string | null; before: string | null } | null>(null);
  dropFolderRef.current = dropFolder;
  dropAtRef.current = dropAt;

  const startDrag = (e: React.PointerEvent, mapId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const top = rowEl(mapId)?.getBoundingClientRect().top ?? 0;
    dragging.current = mapId;
    drag.current = { startY: e.clientY, startTop: top };
    setDropAt(null);
    setDropFolder(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // 줄이 자리를 옮기면 미끄러지듯 움직인다
  const prevTops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const next = new Map<string, number>();
    for (const el of Array.from(list.querySelectorAll<HTMLElement>("[data-row]"))) {
      const key = el.dataset.row!;
      if (key === dragging.current) {
        next.set(key, el.getBoundingClientRect().top);
        continue;
      }
      el.style.transform = "";
      const top = el.getBoundingClientRect().top;
      next.set(key, top);
      const prev = prevTops.current.get(key);
      if (prev !== undefined && Math.abs(prev - top) > 0.5) {
        el.animate([{ transform: `translateY(${prev - top}px)` }, { transform: "none" }], {
          duration: 180,
          easing: "ease-out",
        });
      }
    }
    prevTops.current = next;
  });

  const nameInput = (value: string) => (
    <input
      className="row-name-input"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitName}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commitName();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(null);
        }
      }}
    />
  );

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <span>마인드맵</span>
        <span className="sidebar__actions">
          <button
            className="sidebar__add"
            title="새 폴더"
            onClick={() => {
              createFolder();
              onNavigate?.();
            }}
          >
            🗀
          </button>
          <button
            className="sidebar__add"
            title="새 마인드맵"
            onClick={() => {
              createMap();
              setTrashOpen(false);
              onNavigate?.();
            }}
          >
            +
          </button>
        </span>
      </div>

      <div className="sidebar__list" ref={listRef}>
        {rows.map((row) =>
          row.kind === "folder" ? (
            <div
              key={row.id}
              data-row={row.id}
              className={`folder-item${dropFolder === row.folder.id ? " folder-item--drop" : ""}`}
              onClick={() => toggleFolder(row.folder.id)}
            >
              <span className="folder-item__caret">{row.folder.collapsed ? "▸" : "▾"}</span>
              {editing?.kind === "folder" && editing.id === row.folder.id ? (
                nameInput(row.folder.name)
              ) : (
                <span
                  className="folder-item__name"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setDraft(row.folder.name);
                    setEditing({ kind: "folder", id: row.folder.id });
                  }}
                >
                  {row.folder.name || "이름 없는 폴더"}
                </span>
              )}
              <button
                className="map-item__delete"
                title="폴더 삭제 (안의 맵은 남습니다)"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`"${row.folder.name}" 폴더를 지울까요?\n안의 마인드맵은 목록에 남습니다.`))
                    deleteFolder(row.folder.id);
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <div
              key={row.id}
              data-row={row.id}
              className={`map-item${row.map.id === currentMapId ? " map-item--active" : ""}${
                row.inFolder ? " map-item--nested" : ""
              }${dragging.current === row.map.id ? " map-item--dragging" : ""}${
                dropAt && dropAt.before === row.map.id ? " map-item--dropline" : ""
              }`}
              onClick={() => {
                selectMap(row.map.id);
                setTrashOpen(false);
                onNavigate?.();
              }}
            >
              <span
                className="map-item__handle"
                title="끌어서 순서·폴더 바꾸기"
                onPointerDown={(e) => startDrag(e, row.map.id)}
                onClick={(e) => e.stopPropagation()}
              >
                ≡
              </span>
              {editing?.kind === "map" && editing.id === row.map.id ? (
                nameInput(row.map.title)
              ) : (
                <span
                  className="map-item__title"
                  title={row.map.title}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setDraft(row.map.title);
                    setEditing({ kind: "map", id: row.map.id });
                  }}
                >
                  {row.map.title || "제목 없음"}
                </span>
              )}
              <button
                className="map-item__delete"
                title="삭제"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`"${row.map.title}" 맵을 삭제할까요?`)) deleteMap(row.map.id);
                }}
              >
                ×
              </button>
            </div>
          ),
        )}
      </div>

      <div className="sidebar__section">
        <div className="sidebar__label">테마</div>
        <div className="theme-row">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-chip${t.id === theme ? " theme-chip--active" : ""}`}
              onClick={() => setTheme(t.id)}
              title={t.name}
            >
              <span className="theme-chip__swatch">
                {t.swatch.map((c, i) => (
                  <i key={i} style={{ background: c }} />
                ))}
              </span>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar__section">
        <button
          className="tool-button"
          disabled={!hasPinned}
          onClick={() => {
            if (currentMapId) resetPositions(currentMapId);
            onNavigate?.();
          }}
        >
          자동 정렬로 되돌리기
        </button>
        <button
          className="tool-button"
          onClick={() => {
            setTrashOpen(true);
            onNavigate?.();
          }}
        >
          휴지통{trashCount > 0 ? ` (${trashCount})` : ""}
        </button>
      </div>

      {email && (
        <div className="sidebar__section">
          <div className="account">
            <span
              className={`account__dot account__dot--${syncStatus}`}
              title={SYNC_LABEL[syncStatus]}
            />
            <span className="account__mail" title={email}>
              {email}
            </span>
            <button className="account__out" onClick={() => void signOut()}>
              로그아웃
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
