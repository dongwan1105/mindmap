import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Canvas from "./components/Canvas";
import Login from "./components/Login";
import Trash from "./components/Trash";
import Help from "./components/Help";
import { useMapStore } from "./store/useMapStore";
import { useSync } from "./sync/useSync";

export default function App() {
  const loaded = useMapStore((s) => s.loaded);
  const theme = useMapStore((s) => s.theme);
  const load = useMapStore((s) => s.load);
  const panel = useMapStore((s) => s.panel);
  const [menuOpen, setMenuOpen] = useState(false);
  const { authState, email, status } = useSync();

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  if (!loaded) return null;
  if (authState !== "ready") return <Login state={authState} email={email} />;

  return (
    <div className={`app${menuOpen ? " app--menu" : ""}`}>
      <button
        className="menu-btn"
        aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
        onClick={() => setMenuOpen((o) => !o)}
      >
        {menuOpen ? "✕" : "☰"}
      </button>
      <Sidebar
        email={email}
        syncStatus={status}
        onNavigate={() => setMenuOpen(false)}
      />
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      {panel === "trash" ? <Trash /> : panel === "help" ? <Help /> : <Canvas />}
    </div>
  );
}
