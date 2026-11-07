import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { supabase, syncEnabled } from "../supabase";
import { pendingPurge, setSyncHook, useMapStore } from "../store/useMapStore";
import {
  deleteRows,
  getResetAt,
  isAllowed,
  pullAll,
  pushRows,
  rowToFolder,
  rowToMap,
  rowToNode,
} from "../storage/remote";

const RESET_ACK_KEY = "mindmap.resetAck";

export type AuthState = "loading" | "signed-out" | "denied" | "ready";
export type SyncStatus = "idle" | "syncing" | "synced" | "error";

/**
 * 서버가 가지고 있다고 아는 각 행의 updatedAt.
 * 이 값과 로컬의 updatedAt이 다르면 아직 안 올라간 변경(dirty)이다.
 * 서버에서 받은 행도 여기에 기록하므로, 받은 걸 되돌려 보내는 일은 없다.
 */
const serverHas = {
  folders: new Map<string, number>(),
  maps: new Map<string, number>(),
  nodes: new Map<string, number>(),
};

/** 로그아웃 직전 남은 변경을 올리기 위해 현재 세션을 모듈 수준에 둔다. */
let activeSession: Session | null = null;

/** 아직 서버에 없는 행을 모두 올린다. 올릴 게 없으면 바로 끝난다. */
/** 영구 삭제된 행을 서버에서도 지운다. */
async function flushPurge(): Promise<void> {
  const folders = [...pendingPurge.folders];
  const maps = [...pendingPurge.maps];
  const nodes = [...pendingPurge.nodes];
  if (!folders.length && !maps.length && !nodes.length) return;
  await deleteRows(folders, maps, nodes);
  folders.forEach((id) => {
    pendingPurge.folders.delete(id);
    serverHas.folders.delete(id);
  });
  maps.forEach((id) => {
    pendingPurge.maps.delete(id);
    serverHas.maps.delete(id);
  });
  nodes.forEach((id) => {
    pendingPurge.nodes.delete(id);
    serverHas.nodes.delete(id);
  });
}

async function flushPending(): Promise<void> {
  if (!activeSession) return;
  await flushPurge();
  const { folders, maps, nodes } = useMapStore.getState();
  const dirtyFolders = folders.filter((f) => serverHas.folders.get(f.id) !== f.updatedAt);
  const dirtyMaps = maps.filter((m) => serverHas.maps.get(m.id) !== m.updatedAt);
  const dirtyNodes = nodes.filter((n) => serverHas.nodes.get(n.id) !== n.updatedAt);
  if (!dirtyFolders.length && !dirtyMaps.length && !dirtyNodes.length) return;
  await pushRows(dirtyFolders, dirtyMaps, dirtyNodes, activeSession.user.id);
  dirtyFolders.forEach((f) => serverHas.folders.set(f.id, f.updatedAt));
  dirtyMaps.forEach((m) => serverHas.maps.set(m.id, m.updatedAt));
  dirtyNodes.forEach((n) => serverHas.nodes.set(n.id, n.updatedAt));
}

export function useSync() {
  const [authState, setAuthState] = useState<AuthState>(syncEnabled ? "loading" : "ready");
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const sessionRef = useRef<Session | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 동기화가 꺼져 있으면 로컬 전용으로만 쓴다.
  // 캐시를 다 읽은 뒤에 실행해야 방금 만든 맵이 덮어써지지 않는다.
  const loaded = useMapStore((s) => s.loaded);
  useEffect(() => {
    if (!syncEnabled && loaded) useMapStore.getState().ensureFirstMap();
  }, [loaded]);

  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    const teardown = () => {
      if (channelRef.current) {
        void sb.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setSyncHook(null);
      serverHas.maps.clear();
      serverHas.nodes.clear();
    };

    const pushDirty = async () => {
      const session = sessionRef.current;
      if (!session) return;
      const { folders, maps, nodes } = useMapStore.getState();
      const dirtyFolders = folders.filter((f) => serverHas.folders.get(f.id) !== f.updatedAt);
      const dirtyMaps = maps.filter((m) => serverHas.maps.get(m.id) !== m.updatedAt);
      const dirtyNodes = nodes.filter((n) => serverHas.nodes.get(n.id) !== n.updatedAt);
      const hasPurge =
        pendingPurge.folders.size > 0 || pendingPurge.maps.size > 0 || pendingPurge.nodes.size > 0;
      if (!dirtyFolders.length && !dirtyMaps.length && !dirtyNodes.length && !hasPurge) return;
      setStatus("syncing");
      try {
        await flushPurge();
        await pushRows(dirtyFolders, dirtyMaps, dirtyNodes, session.user.id);
        dirtyFolders.forEach((f) => serverHas.folders.set(f.id, f.updatedAt));
        dirtyMaps.forEach((m) => serverHas.maps.set(m.id, m.updatedAt));
        dirtyNodes.forEach((n) => serverHas.nodes.set(n.id, n.updatedAt));
        setStatus("synced");
      } catch (e) {
        console.error("[sync] 업로드 실패", e);
        setStatus("error");
      }
    };

    const start = async (session: Session) => {
      sessionRef.current = session;
      activeSession = session;
      setEmail(session.user.email ?? null);

      if (!(await isAllowed())) {
        setAuthState("denied");
        return;
      }
      setAuthState("ready");
      setStatus("syncing");

      try {
        // 전체 초기화가 있었다면, 이 기기의 오래된 사본을 먼저 버린다.
        // 그러지 않으면 지워진 내용이 이 기기에서 다시 올라간다.
        const resetAt = await getResetAt();
        const acked = Number(localStorage.getItem(RESET_ACK_KEY) || 0);
        if (resetAt > acked) {
          useMapStore.getState().clearLocal();
          serverHas.folders.clear();
          serverHas.maps.clear();
          serverHas.nodes.clear();
          pendingPurge.folders.clear();
          pendingPurge.maps.clear();
          pendingPurge.nodes.clear();
          localStorage.setItem(RESET_ACK_KEY, String(resetAt));
        }

        const remote = await pullAll();
        remote.folders.forEach((f) => serverHas.folders.set(f.id, f.updatedAt));
        remote.maps.forEach((m) => serverHas.maps.set(m.id, m.updatedAt));
        remote.nodes.forEach((n) => serverHas.nodes.set(n.id, n.updatedAt));
        useMapStore.getState().mergeRemote(remote.folders, remote.maps, remote.nodes);
        useMapStore.getState().ensureFirstMap();
        await pushDirty();
        setStatus("synced");
      } catch (e) {
        console.error("[sync] 내려받기 실패", e);
        setStatus("error");
        useMapStore.getState().ensureFirstMap();
      }

      // 로컬이 바뀔 때마다 올린다 (저장 자체는 이미 디바운스되어 있음)
      setSyncHook(() => {
        if (pushTimer.current) clearTimeout(pushTimer.current);
        pushTimer.current = setTimeout(() => void pushDirty(), 400);
      });

      // 다른 기기의 변경을 받아 반영한다
      const uid = session.user.id;
      const ch = sb
        .channel("mindmap-sync")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "mindmap_folders", filter: `user_id=eq.${uid}` },
          (payload) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string })?.id;
              if (id) {
                serverHas.folders.delete(id);
                useMapStore.getState().removeLocal([id], [], []);
              }
              return;
            }
            if (!payload.new || !("id" in payload.new)) return;
            const f = rowToFolder(payload.new as never);
            serverHas.folders.set(f.id, f.updatedAt);
            useMapStore.getState().mergeRemote([f], [], []);
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "mindmap_maps", filter: `user_id=eq.${uid}` },
          (payload) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string })?.id;
              if (id) {
                serverHas.maps.delete(id);
                useMapStore.getState().removeLocal([], [id], []);
              }
              return;
            }
            if (!payload.new || !("id" in payload.new)) return;
            const m = rowToMap(payload.new as never);
            serverHas.maps.set(m.id, m.updatedAt);
            useMapStore.getState().mergeRemote([], [m], []);
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "mindmap_nodes", filter: `user_id=eq.${uid}` },
          (payload) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string })?.id;
              if (id) {
                serverHas.nodes.delete(id);
                useMapStore.getState().removeLocal([], [], [id]);
              }
              return;
            }
            if (!payload.new || !("id" in payload.new)) return;
            const n = rowToNode(payload.new as never);
            serverHas.nodes.set(n.id, n.updatedAt);
            useMapStore.getState().mergeRemote([], [], [n]);
          },
        )
        .subscribe();
      channelRef.current = ch;
    };

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) {
        if (sessionRef.current?.user.id === session.user.id && channelRef.current) return;
        void start(session);
      } else {
        teardown();
        sessionRef.current = null;
        activeSession = null;
        setEmail(null);
        setAuthState("signed-out");
        setStatus("idle");
      }
    });

    return () => {
      sub.subscription.unsubscribe();
      teardown();
    };
  }, []);

  return { authState, email, status };
}

export async function signInWithGoogle() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

/** Supabase가 돌려주는 영문 오류를 쓸 만한 한국어로 바꾼다. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "메일 주소나 비밀번호가 맞지 않습니다.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "이미 가입된 메일 주소입니다. 로그인해 주세요.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "지금은 새 계정을 만들 수 없습니다. Supabase에서 가입을 잠시 열어야 합니다.";
  if (m.includes("password should be")) return "비밀번호는 6자 이상이어야 합니다.";
  if (m.includes("email rate limit") || m.includes("rate limit"))
    return "메일 발송 한도에 걸렸습니다. 잠시 뒤 다시 시도해 주세요.";
  if (m.includes("email not confirmed"))
    return "메일 인증이 필요한 설정입니다. Supabase에서 Confirm email을 꺼 주세요.";
  return message;
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error("동기화가 설정되지 않았습니다");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendly(error.message));
}

export async function signUpWithPassword(email: string, password: string) {
  if (!supabase) throw new Error("동기화가 설정되지 않았습니다");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(friendly(error.message));
  // Confirm email이 켜져 있으면 세션 없이 확인 메일만 발송된다
  if (!data.session) {
    throw new Error("계정은 만들어졌지만 메일 인증이 필요합니다. Supabase에서 Confirm email을 꺼 주세요.");
  }
}

export async function signOut() {
  // 아직 안 올라간 변경이 있으면 먼저 올린다.
  // 올리지 못하면 로컬 캐시를 지우지 않는다 — 지우면 그 작업은 영영 사라진다.
  let flushed = true;
  try {
    await flushPending();
  } catch (e) {
    console.error("[sync] 로그아웃 전 업로드 실패", e);
    flushed = false;
  }
  if (!flushed) {
    const go = confirm(
      "아직 서버에 올라가지 않은 변경이 있습니다.\n지금 로그아웃하면 이 기기에는 남지만 다른 기기에서는 볼 수 없습니다.\n\n로그아웃할까요?",
    );
    if (!go) return;
  } else {
    useMapStore.getState().clearLocal();
  }
  if (supabase) await supabase.auth.signOut();
}
