import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { supabase, syncEnabled } from "../supabase";
import { setSyncHook, useMapStore } from "../store/useMapStore";
import { isAllowed, pullAll, pushRows, rowToMap, rowToNode } from "../storage/remote";

export type AuthState = "loading" | "signed-out" | "denied" | "ready";
export type SyncStatus = "idle" | "syncing" | "synced" | "error";

/**
 * 서버가 가지고 있다고 아는 각 행의 updatedAt.
 * 이 값과 로컬의 updatedAt이 다르면 아직 안 올라간 변경(dirty)이다.
 * 서버에서 받은 행도 여기에 기록하므로, 받은 걸 되돌려 보내는 일은 없다.
 */
const serverHas = { maps: new Map<string, number>(), nodes: new Map<string, number>() };

export function useSync() {
  const [authState, setAuthState] = useState<AuthState>(syncEnabled ? "loading" : "ready");
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const sessionRef = useRef<Session | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 동기화가 꺼져 있으면 로컬 전용으로만 쓴다
  useEffect(() => {
    if (!syncEnabled) useMapStore.getState().ensureFirstMap();
  }, []);

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
      const { maps, nodes } = useMapStore.getState();
      const dirtyMaps = maps.filter((m) => serverHas.maps.get(m.id) !== m.updatedAt);
      const dirtyNodes = nodes.filter((n) => serverHas.nodes.get(n.id) !== n.updatedAt);
      if (!dirtyMaps.length && !dirtyNodes.length) return;
      setStatus("syncing");
      try {
        await pushRows(dirtyMaps, dirtyNodes, session.user.id);
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
      setEmail(session.user.email ?? null);

      if (!(await isAllowed())) {
        setAuthState("denied");
        return;
      }
      setAuthState("ready");
      setStatus("syncing");

      try {
        const remote = await pullAll();
        remote.maps.forEach((m) => serverHas.maps.set(m.id, m.updatedAt));
        remote.nodes.forEach((n) => serverHas.nodes.set(n.id, n.updatedAt));
        useMapStore.getState().mergeRemote(remote.maps, remote.nodes);
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
          { event: "*", schema: "public", table: "mindmap_maps", filter: `user_id=eq.${uid}` },
          (payload) => {
            if (!payload.new || !("id" in payload.new)) return;
            const m = rowToMap(payload.new as never);
            serverHas.maps.set(m.id, m.updatedAt);
            useMapStore.getState().mergeRemote([m], []);
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "mindmap_nodes", filter: `user_id=eq.${uid}` },
          (payload) => {
            if (!payload.new || !("id" in payload.new)) return;
            const n = rowToNode(payload.new as never);
            serverHas.nodes.set(n.id, n.updatedAt);
            useMapStore.getState().mergeRemote([], [n]);
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
  useMapStore.getState().clearLocal();
  if (supabase) await supabase.auth.signOut();
}
