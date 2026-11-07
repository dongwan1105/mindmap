import { useState } from "react";
import {
  signInWithGoogle,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  type AuthState,
} from "../sync/useSync";
import { googleEnabled } from "../supabase";

export default function Login({ state, email }: { state: AuthState; email: string | null }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [mail, setMail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (state === "loading") {
    return (
      <div className="gate">
        <div className="gate__card">
          <div className="gate__muted">불러오는 중…</div>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="gate">
        <div className="gate__card">
          <h1 className="gate__title">접근 권한이 없습니다</h1>
          <p className="gate__muted">
            {email}
            <br />이 계정은 허용 목록에 없습니다.
          </p>
          <button className="gate__btn" onClick={() => void signOut()}>
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  const ok = mail.includes("@") && pw.length >= 6;

  const submit = async () => {
    if (!ok || busy) return;
    setErr(null);
    setBusy(true);
    try {
      if (mode === "in") await signInWithPassword(mail.trim(), pw);
      else await signUpWithPassword(mail.trim(), pw);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "로그인하지 못했습니다");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <div className="gate__card">
        <h1 className="gate__title">마인드맵</h1>
        <p className="gate__muted">로그인하면 모든 기기에서 같은 내용을 볼 수 있습니다.</p>

        <div className="gate__tabs">
          <button
            className={`gate__tab${mode === "in" ? " gate__tab--on" : ""}`}
            onClick={() => {
              setMode("in");
              setErr(null);
            }}
          >
            로그인
          </button>
          <button
            className={`gate__tab${mode === "up" ? " gate__tab--on" : ""}`}
            onClick={() => {
              setMode("up");
              setErr(null);
            }}
          >
            계정 만들기
          </button>
        </div>

        <input
          className="gate__input"
          type="email"
          autoComplete="username"
          placeholder="메일 주소"
          value={mail}
          onChange={(e) => setMail(e.target.value)}
        />
        <input
          className="gate__input"
          type="password"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          placeholder="비밀번호 (6자 이상)"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />

        <button className="gate__btn gate__btn--primary" disabled={!ok || busy} onClick={() => void submit()}>
          {busy ? "잠시만요…" : mode === "in" ? "로그인" : "계정 만들고 시작하기"}
        </button>

        {googleEnabled && (
          <>
            <div className="gate__or">또는</div>
            <button className="gate__btn" onClick={() => void signInWithGoogle()}>
              Google로 계속하기
            </button>
          </>
        )}

        {err && <p className="gate__err">{err}</p>}
      </div>
    </div>
  );
}
