import { useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Canvas from "./components/Canvas";
import Login from "./components/Login";
import { useMapStore } from "./store/useMapStore";
import { useSync } from "./sync/useSync";

export default function App() {
  const loaded = useMapStore((s) => s.loaded);
  const theme = useMapStore((s) => s.theme);
  const load = useMapStore((s) => s.load);
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
    <div className="app">
      <Sidebar email={email} syncStatus={status} />
      <Canvas />
    </div>
  );
}
