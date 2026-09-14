export default function Loading() {
  return <main className="min-h-screen bg-[#f4f6fb] p-5 md:p-8"><div className="mx-auto max-w-6xl space-y-5" aria-label="Loading RentFlow"><div className="h-16 animate-pulse rounded-2xl bg-slate-200" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div className="h-28 animate-pulse rounded-2xl bg-slate-200" key={index} />)}</div><div className="h-80 animate-pulse rounded-2xl bg-slate-200" /></div></main>;
}

