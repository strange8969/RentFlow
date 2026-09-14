"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function PwaRegister() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (online) return null;
  return <div role="status" className="fixed inset-x-3 top-3 z-[100] mx-auto flex min-h-11 max-w-md items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-xl"><WifiOff className="size-4" /> Offline — viewing only. Financial submissions require a connection.</div>;
}
