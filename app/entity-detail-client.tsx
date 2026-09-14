"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, Building2, FileText, Home, IndianRupee, Loader2, ReceiptText, RefreshCw, UserRound, UsersRound, WalletCards, Wrench, Zap } from "lucide-react";

type Row = Record<string, any>;
const tabs: Record<string, { id: string; label: string }[]> = {
  property: [{id:"overview",label:"Overview"},{id:"rooms",label:"Rooms"},{id:"tenancies",label:"Tenancies"},{id:"financials",label:"Financials"},{id:"documents",label:"Documents"},{id:"activity",label:"Activity"}],
  room: [{id:"overview",label:"Overview"},{id:"tenancies",label:"Tenancies"},{id:"billing",label:"Billing & Payments"},{id:"electricity",label:"Electricity"},{id:"documents",label:"Documents"},{id:"maintenance",label:"Maintenance"}],
  tenant: [{id:"overview",label:"Overview"},{id:"tenancies",label:"Tenancies"},{id:"ledger",label:"Ledger"},{id:"bills",label:"Bills"},{id:"payments",label:"Payments"},{id:"deposits",label:"Deposits & Settlement"},{id:"documents",label:"Documents"},{id:"activity",label:"Activity"}],
};

export default function EntityDetail({ kind, id }: { kind: "property" | "room" | "tenant"; id: string }) {
  const initialTab = typeof window === "undefined" ? tabs[kind][0].id : new URLSearchParams(window.location.search).get("tab") || tabs[kind][0].id;
  const [tab, setTab] = useState(tabs[kind].some((item) => item.id === initialTab) ? initialTab : tabs[kind][0].id);
  const [tenancyId, setTenancyId] = useState(typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("tenancyId") || "");
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (nextTab = tab, nextTenancy = tenancyId) => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ tab: nextTab });
      if (nextTenancy) query.set("tenancyId", nextTenancy);
      const response = await fetch(`/api/details/${kind}/${encodeURIComponent(id)}?${query}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "This record could not be loaded.");
      setData(body);
      if (!nextTenancy && body.selectedTenancyId) setTenancyId(body.selectedTenancyId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "This record could not be loaded."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [kind, id, tab, tenancyId]);
  useEffect(() => {
    const onPop = () => {
      const query = new URLSearchParams(window.location.search);
      setTab(query.get("tab") || tabs[kind][0].id);
      setTenancyId(query.get("tenancyId") || "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [kind]);

  const changeTab = (next: string) => {
    const query = new URLSearchParams(window.location.search);
    query.set("tab", next);
    if (tenancyId) query.set("tenancyId", tenancyId);
    window.history.pushState({}, "", `${window.location.pathname}?${query}`);
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const changeTenancy = (next: string) => {
    const query = new URLSearchParams(window.location.search);
    if (next) query.set("tenancyId", next); else query.delete("tenancyId");
    window.history.pushState({}, "", `${window.location.pathname}?${query}`);
    setTenancyId(next);
  };

  if (loading && !data) return <PageState icon={<Loader2 className="size-7 animate-spin" />} title="Loading details…" />;
  if (error && !data) return <PageState icon={<RefreshCw className="size-7" />} title={error} action={<button className="button primary" onClick={() => load()}>Try again</button>} />;
  if (!data) return null;

  const entity = data.entity;
  const title = kind === "property" ? entity.name : kind === "room" ? `Room ${entity.room_number}` : entity.full_name;
  const subtitle = kind === "property" ? entity.address : kind === "room" ? data.property?.name : data.selectedTenancyId ? `${data.property?.name || "Property"} · Room ${data.room?.room_number || "—"}` : "Tenant profile";
  return <div className="min-h-screen bg-[#f4f6fb] text-slate-900">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-[68px] max-w-[1500px] items-center gap-3 px-4 md:px-7">
        <a href="/" className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-600 text-white" aria-label="RentFlow home"><Home className="size-5" /></a>
        <div className="min-w-0"><b>RentFlow</b><p className="truncate text-xs text-slate-500">Connected rental records</p></div>
        <nav className="ml-auto hidden gap-1 sm:flex" aria-label="Primary"><Nav href="/properties" label="Properties" /><Nav href="/rooms" label="Rooms" /><Nav href="/?page=tenants" label="Tenants" /></nav>
      </div>
    </header>
    <main className="mx-auto max-w-[1500px] px-4 py-5 pb-24 md:px-7 md:py-8">
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
        <a className="link" href="/properties">Properties</a>
        {kind !== "property" && data.property && <><span>/</span><a className="link" href={`/properties/${data.property.id}`}>{data.property.name}</a></>}
        {kind === "tenant" && data.room && <><span>/</span><a className="link" href={`/rooms/${data.room.id}`}>Room {data.room.room_number}</a></>}
        <span>/</span><span className="font-semibold text-slate-800">{title}</span>
      </nav>
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div><a className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-700" href={kind === "property" ? "/properties" : kind === "room" ? `/properties/${data.property?.id}?tab=rooms` : "/?page=tenants"}><ArrowLeft className="size-4" /> Back to results</a><h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle || "No address added"}</p></div>
        <div className="ml-auto flex flex-wrap gap-2"><Status value={entity.active === 0 ? "archived" : kind === "tenant" ? (data.activeTenancy?.status || entity.status) : kind === "room" ? entity.status : "active"} />{data.activeTenancy && <ActionLink action="payment" tenancyId={data.activeTenancy.id}>Record payment</ActionLink>}{kind === "room" && data.activeTenancy && <ActionLink action="reading" tenancyId={data.activeTenancy.id}>Add meter reading</ActionLink>}{kind === "room" && !data.activeTenancy && <ActionLink action="tenancy" roomId={entity.id} propertyId={data.property?.id}>Create tenancy</ActionLink>}</div>
      </div>
      {(kind === "room" || kind === "tenant") && data.tenancies.length > 0 && <label className="mb-4 block max-w-md text-sm font-semibold">Tenancy context<select className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3" value={tenancyId || data.selectedTenancyId || ""} onChange={(event) => changeTenancy(event.target.value)}>{data.tenancies.map((item: Row) => <option key={item.id} value={item.id}>{formatDate(item.move_in_date)} – {item.move_out_date ? formatDate(item.move_out_date) : "Present"} · {item.status}</option>)}</select></label>}
      <div className="mb-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 [scrollbar-width:none]" role="tablist" aria-label={`${title} sections`}>{tabs[kind].map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => changeTab(item.id)} className={`min-h-11 whitespace-nowrap rounded-xl px-4 text-sm font-semibold ${tab === item.id ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{item.label}</button>)}</div>
      {loading && <div className="mb-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Refreshing this section…</div>}
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} <button className="font-bold underline" onClick={() => load()}>Retry</button></div>}
      <DetailContent kind={kind} tab={tab} data={data} />
    </main>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white p-1 pb-[max(.25rem,env(safe-area-inset-bottom))] sm:hidden" aria-label="Mobile navigation"><Mobile href="/" icon={<Home />} label="Home" /><Mobile href="/properties" icon={<Building2 />} label="Properties" /><Mobile href="/rooms" icon={<UsersRound />} label="Rooms" /><Mobile href="/?page=tenants" icon={<UserRound />} label="Tenants" /></nav>
  </div>;
}

function DetailContent({ kind, tab, data }: { kind: string; tab: string; data: Row }) {
  const selected = data.tenancies.find((item: Row) => item.id === data.selectedTenancyId);
  if (tab === "overview") return <Overview kind={kind} data={data} selected={selected} />;
  if (tab === "rooms") return <Rooms data={data} />;
  if (tab === "tenancies") return <Tenancies data={data} />;
  if (["financials","ledger","bills","payments","deposits","billing"].includes(tab)) return <Finance tab={tab} data={data} />;
  if (tab === "electricity") return <Electricity data={data} />;
  if (tab === "documents") return <Documents data={data} />;
  if (tab === "maintenance") return <Maintenance data={data} />;
  if (tab === "activity") return <ActivityList data={data} />;
  return <Empty text="Nothing has been recorded in this section." />;
}
function Overview({ kind, data, selected }: any) {
  const rooms = data.rooms || data.relatedRooms || []; const occupied = rooms.filter((item: Row) => item.tenancy || item.status === "occupied").length;
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {kind === "property" && <><Metric label="Total rooms" value={rooms.length} /><Metric label="Occupied" value={occupied} /><Metric label="Vacant" value={Math.max(0, rooms.length-occupied)} /><Metric label="Active tenancies" value={data.tenancies.filter((item: Row)=>["active","notice"].includes(item.status)).length} /></>}
    {kind === "room" && <><Metric label="Occupancy" value={data.activeTenancy ? "Occupied" : "Vacant"} /><Metric label="Tenancies" value={data.tenancies.length} /><Metric label="Floor" value={data.entity.floor || "—"} /><Metric label="Meter" value={data.entity.meter_number || "—"} /></>}
    {kind === "tenant" && <><Metric label="Status" value={data.activeTenancy?.status || data.entity.status || "Inactive"} /><Metric label="Stays" value={data.tenancies.length} /><Metric label="Mobile" value={data.entity.phone || "—"} /><Metric label="Email" value={data.entity.email || "—"} /></>}
  </div>
  {selected && <Panel title="Selected tenancy"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="Move-in" value={formatDate(selected.move_in_date)} /><Info label="Move-out" value={selected.move_out_date ? formatDate(selected.move_out_date) : "Present"} /><Info label="Rent due day" value={selected.rent_due_day ? `Day ${selected.rent_due_day}` : "—"} /><Info label="Initial meter" value={selected.initial_meter_reading ?? "—"} /></div><div className="mt-3 flex flex-wrap gap-2">{data.property && <a className="button secondary" href={`/properties/${data.property.id}`}>{data.property.name}</a>}{data.room && <a className="button secondary" href={`/rooms/${data.room.id}`}>Room {data.room.room_number}</a>}{kind !== "tenant" && selected.tenant_id && <a className="button primary" href={`/tenants/${selected.tenant_id}?tenancyId=${selected.id}`}>View tenant</a>}</div></Panel>}
  {data.finance && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Billed (loaded records)" value={money(data.finance.billed_paise)} /><Metric label="Allocated payments" value={money(data.finance.paid_to_charges_paise)} /><Metric label="Outstanding" value={money(data.finance.outstanding_paise)} /><Metric label="Cash received" value={money(data.finance.cash_received_paise)} /></div>}
  {kind === "property" && <Rooms data={data} compact />}
  {data.maintenance?.length > 0 && <Maintenance data={data} />}
  {data.activity?.length > 0 && <ActivityList data={data} />}
  </div>;
}
function Rooms({ data, compact=false }: any) { const items=data.rooms || []; return <Panel title={compact ? "Rooms at this property" : "All rooms"} action={data.entity?.id && data.kind==="property" ? <ActionLink action="room" propertyId={data.entity.id}>Add room</ActionLink> : null}>{items.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((room: Row)=><a className="group rounded-xl border border-slate-200 p-4 hover:border-violet-300 hover:bg-violet-50/40" href={`/rooms/${room.id}`} key={room.id}><div className="flex items-start justify-between gap-2"><b>Room {room.room_number}</b><Status value={room.tenancy ? room.tenancy.status : room.status || "vacant"} /></div><p className="mt-2 text-sm text-slate-500">{room.floor ? `Floor ${room.floor} · ` : ""}{room.meter_number || "No meter number"}</p><p className="mt-3 text-sm font-semibold text-violet-700">{room.tenant?.full_name || "Vacant — create a tenancy"}</p></a>)}</div>:<Empty text="No rooms have been added to this property." />}</Panel> }
function Tenancies({ data }: any) { return <Panel title="Tenancy history">{data.tenancies.length ? <div className="space-y-3">{data.tenancies.map((item: Row)=>{const tenant=data.lookups?.tenantById?.[item.tenant_id]; const room=data.lookups?.roomById?.[item.room_id] || data.room; const property=data.lookups?.propertyById?.[item.property_id] || data.property; return <div className="rounded-xl border border-slate-200 p-4" key={item.id}><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><b>{tenant?.full_name || data.tenant?.full_name || "Tenant"}</b><p className="mt-1 text-sm text-slate-500">{formatDate(item.move_in_date)} – {item.move_out_date ? formatDate(item.move_out_date) : "Present"}{property ? ` · ${property.name}` : ""}{room ? ` / Room ${room.room_number}` : ""}</p></div><Status value={item.status} /></div><div className="mt-3 flex flex-wrap gap-2">{property && <a className="button secondary" href={`/properties/${property.id}?tab=tenancies`}>View property</a>}{room && <a className="button secondary" href={`/rooms/${room.id}?tenancyId=${item.id}`}>View room</a>}<a className="button primary" href={`/tenants/${item.tenant_id}?tenancyId=${item.id}`}>View tenant</a></div></div>})}</div>:<Empty text="No tenancy history exists for this record." />}</Panel> }
function Finance({ tab, data }: any) { const f=data.finance||{charges:[],payments:[],deposits:[]}; const showCharges=tab!=="payments"&&tab!=="deposits"; return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Billed" value={money(f.billed_paise)} /><Metric label="Paid to charges" value={money(f.paid_to_charges_paise)} /><Metric label="Outstanding" value={money(f.outstanding_paise)} /><Metric label="Cash received" value={money(f.cash_received_paise)} /></div>{showCharges&&<Panel title="Bills and charges">{f.charges?.length?<div className="space-y-2">{f.charges.map((item: Row)=><RecordRow key={item.chargeType+item.id} title={title(item.chargeType)} subtitle={formatMonthOrDate(item.date)} value={money(item.total_paise)} meta={`Paid ${money(item.paid_paise)} · Due ${money(item.balance_paise)}`} />)}</div>:<Empty text="No charges found for this tenancy context." />}</Panel>}{tab!=="bills"&&tab!=="deposits"&&<Panel title="Payments">{f.payments?.length?<div className="space-y-2">{f.payments.map((item: Row)=><RecordRow key={item.id} title={money(item.amount_paise)} subtitle={formatDate(item.payment_date)} value={title(item.mode)} meta={item.reference||item.status} />)}</div>:<Empty text="No payments found for this tenancy context." />}</Panel>}{tab==="deposits"&&<Panel title="Deposit ledger">{f.deposits?.length?<div className="space-y-2">{f.deposits.map((item: Row)=><RecordRow key={item.id} title={title(item.type)} subtitle={formatDate(item.date)} value={money(item.amount_paise)} meta={item.notes} />)}</div>:<Empty text="No deposit entries found." />}</Panel>}</div> }
function Electricity({data}:any){const e=data.electricity||{readings:[],bills:[],rates:[]};return <div className="space-y-4"><Panel title="Meter readings">{e.readings.length?<div className="space-y-2">{e.readings.map((r:Row)=><RecordRow key={r.id} title={formatMonthOrDate(r.billing_month)} subtitle={`${r.previous_reading} → ${r.current_reading}`} value={`${r.units} units`} meta={r.notes} />)}</div>:<Empty text="No readings for the selected tenancy." />}</Panel><Panel title="Electricity rates">{e.rates.length?<div className="space-y-2">{e.rates.map((r:Row)=><RecordRow key={r.id} title={`${money(r.rate_paise_per_unit)}/unit`} subtitle={`Effective ${formatDate(r.effective_from)}`} value={`${money(r.fixed_charge_paise)} fixed`} />)}</div>:<Empty text="No electricity rates for the selected tenancy." />}</Panel></div>}
function Documents({data}:any){return <Panel title="Private documents">{data.documents?.length?<div className="space-y-2">{data.documents.map((d:Row)=><div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3" key={d.id}><FileText className="size-5 text-violet-600"/><div className="min-w-0 flex-1"><b className="break-words text-sm">{d.filename}</b><p className="text-xs text-slate-500">{title(d.type)} · {formatDate(d.created_at)}</p></div><a className="button secondary" target="_blank" rel="noreferrer" href={`/api/documents/${d.id}`}>Open</a></div>)}</div>:<Empty text="No documents are attached here." />}</Panel>}
function Maintenance({data}:any){return <Panel title="Maintenance">{data.maintenance?.length?<div className="space-y-2">{data.maintenance.map((m:Row)=><RecordRow key={m.id} title={m.title||m.description||"Maintenance issue"} subtitle={formatDate(m.reported_date)} value={title(m.status)} meta={m.vendor_name||m.notes} />)}</div>:<Empty text="No maintenance records found." />}</Panel>}
function ActivityList({data}:any){return <Panel title="Activity history">{data.activity?.length?<div className="space-y-2">{data.activity.map((a:Row)=><RecordRow key={a.id} title={title(a.action)} subtitle={formatDateTime(a.created_at)} value={title(a.entity_type)} meta={a.actor_email} />)}</div>:<Empty text="No activity has been recorded for this record." />}</Panel>}
function Panel({title:heading,children,action}:any){return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center gap-3"><h2 className="font-bold">{heading}</h2>{action&&<div className="ml-auto">{action}</div>}</div>{children}</section>}
function Metric({label,value}:any){return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 break-words text-xl font-black">{value}</p></div>}
function Info({label,value}:any){return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-semibold">{value??"—"}</p></div>}
function RecordRow({title:heading,subtitle,value,meta}:any){return <div className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0 flex-1"><b className="text-sm">{heading}</b><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><div className="text-right text-sm font-semibold">{value}<p className="mt-1 text-xs font-normal text-slate-500">{meta}</p></div></div>}
function Empty({text}:any){return <div className="grid min-h-32 place-items-center rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</div>}
function Status({value}:{value:string}){const good=["active","occupied","paid","recorded"];return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${good.includes(String(value))?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-600"}`}>{title(value||"unknown")}</span>}
function ActionLink({action,tenancyId,roomId,propertyId,children}:any){const q=new URLSearchParams({action});if(tenancyId)q.set("tenancyId",tenancyId);if(roomId)q.set("roomId",roomId);if(propertyId)q.set("propertyId",propertyId);return <a className="button primary" href={`/?${q}`}>{children}</a>}
function Nav({href,label}:any){return <a className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100" href={href}>{label}</a>}
function Mobile({href,icon,label}:any){return <a className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-slate-600" href={href}>{<span className="[&>svg]:size-5">{icon}</span>}{label}</a>}
function PageState({icon,title,action}:any){return <div className="grid min-h-screen place-items-center bg-[#f4f6fb] p-6 text-center"><div>{<div className="mx-auto grid size-14 place-items-center rounded-2xl bg-violet-50 text-violet-700">{icon}</div>}<h1 className="mt-4 text-xl font-bold">{title}</h1>{action&&<div className="mt-4">{action}</div>}<a className="mt-4 block text-sm font-semibold text-violet-700" href="/">Return to RentFlow</a></div></div>}
function money(paise:any){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:Number(paise)%100?2:0}).format((Number(paise)||0)/100)}
function formatDate(value:any){if(!value)return "—";return new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(String(value).length===10?`${value}T00:00:00Z`:value))}
function formatDateTime(value:any){if(!value)return "—";return new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value))}
function formatMonthOrDate(value:any){return /^\d{4}-\d{2}$/.test(String(value))?new Intl.DateTimeFormat("en-IN",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}-01T00:00:00Z`)):formatDate(value)}
function title(value:any){return String(value||"").replace(/_/g," ").replace(/\b\w/g,(c)=>c.toUpperCase())}
