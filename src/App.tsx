import { useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Canvas from "./components/Canvas";
import { useMapStore } from "./store/useMapStore";

export default function App() {
  const loaded = useMapStore((s) => s.loaded);
  const load = useMapStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) return null;

  return (
    <div className="app">
      <Sidebar />
      <Canvas />
    </div>
  );
}
