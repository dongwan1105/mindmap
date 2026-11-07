import { useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Canvas from "./components/Canvas";
import { useMapStore } from "./store/useMapStore";

export default function App() {
  const loaded = useMapStore((s) => s.loaded);
  const theme = useMapStore((s) => s.theme);
  const load = useMapStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  if (!loaded) return null;

  return (
    <div className="app">
      <Sidebar />
      <Canvas />
    </div>
  );
}
