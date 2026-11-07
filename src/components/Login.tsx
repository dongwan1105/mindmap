import { useState } from "react";
import { signInWithEmail, signInWithGoogle, signOut, type AuthState } from "../sync/useSync";

export default function Login({ state, email }: { state: AuthState; email: string | null }) {
  const [mail, setMail] = useState("");
  const [sent, setSent] = useState(false);
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

  const send = async () => {
    setErr(null);
    setBusy(true);
    try {
      await signInWithEmail(mail.trim());
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "메일을 보내지 못했습니다");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <div className="gate__card">
        <h1 className="gate__title">마인드맵</h1>
        <p className="gate__muted">로그인하면 모든 기기에서 같은 내용을 볼 수 있습니다.</p>

        <button className="gate__btn gate__btn--primary" onClick={() => void signInWithGoogle()}>
          Google로 계속하기
        </button>

        <div className="gate__or">또는</div>

        {sent ? (
          <p className="gate__muted">
            {mail} 으로 로그인 링크를 보냈습니다.
            <br />
            메일함을 확인해 주세요.
          </p>
        ) : (
          <>
            <input
              className="gate__input"
              type="email"
              placeholder="메일 주소"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && mail.includes("@")) void send();
              }}
            />
            <button
              className="gate__btn"
              disabled={busy || !mail.includes("@")}
              onClick={() => void send()}
            >
              {busy ? "보내는 중…" : "로그인 링크 받기"}
            </button>
          </>
        )}

        {err && <p className="gate__err">{err}</p>}
      </div>
    </div>
  );
}
