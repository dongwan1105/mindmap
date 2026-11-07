import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** 환경변수가 없으면 로그인/동기화 없이 로컬 전용으로 동작한다. */
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true, // 한 번 로그인하면 계속 유지
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const syncEnabled = supabase !== null;
