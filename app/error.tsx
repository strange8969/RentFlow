"use client";

import { useEffect } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("RentFlow screen failed", error.message); }, [error]);
  return <main className="grid min-h-screen place-items-center bg-[#f4f6fb] p-5"><section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-700"><CircleAlert /></div><h1 className="mt-4 text-2xl font-black text-slate-900">This RentFlow screen could not open</h1><p className="mt-2 text-sm leading-6 text-slate-600">Your saved data was not changed. Retry the screen; if the problem continues, return to the dashboard and try the action again.</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Button onClick={reset}><RefreshCw /> Retry</Button><Button asChild variant="outline"><a href="/">Return to dashboard</a></Button></div></section></main>;
}

