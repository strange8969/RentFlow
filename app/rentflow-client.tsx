"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, Archive, Banknote, BarChart3, Building2, CalendarDays, ChevronLeft, ChevronRight,
  CircleAlert, Download, FileText, Gauge, Home, IndianRupee, LayoutDashboard, Menu,
  Plus, ReceiptText, RefreshCw, Search, Settings, ShieldCheck, Trash2, Upload, UserRound, UsersRound,
  WalletCards, Zap, LogOut, CheckCircle2, Clock3, Printer, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader,
  SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { combinedBillSummary } from "./billing-summary";
import { nextAvailableReadingMonth } from "./meter-readings";

type Row = Record<string, any>;
type DataState = {
  settings: Row; properties: Row[]; rooms: Row[]; tenants: Row[]; tenancies: Row[];
  rentRateHistory: Row[]; electricityRateHistory: Row[]; rentCharges: Row[]; electricityReadings: Row[];
  electricityBills: Row[]; otherCharges: Row[]; payments: Row[]; allocations: Row[]; deposits: Row[];
  receipts: Row[]; documents: Row[]; auditLog: Row[];
};
type PageKey = "dashboard" | "properties" | "rooms" | "tenants" | "rent" | "electricity" | "payments" | "reports" | "documents" | "settings";
type DialogKey = "property" | "room" | "tenant" | "tenancy" | "payment" | "reading" | "other" | "deposit" | "rate" | "notice" | "moveout" | "upload" | "settings" | "erase" | "bill" | "ledger" | null;

const pages: { key: PageKey; label: string; icon: typeof Home }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard }, { key: "properties", label: "Properties", icon: Building2 },
  { key: "rooms", label: "Rooms", icon: Home }, { key: "tenants", label: "Tenants", icon: UsersRound },
  { key: "rent", label: "Rent", icon: IndianRupee }, { key: "electricity", label: "Electricity", icon: Zap },
  { key: "payments", label: "Payments", icon: WalletCards }, { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "documents", label: "Documents", icon: FileText }, { key: "settings", label: "Settings", icon: Settings },
];
const emptyState: DataState = { settings: {}, properties: [], rooms: [], tenants: [], tenancies: [], rentRateHistory: [], electricityRateHistory: [], rentCharges: [], electricityReadings: [], electricityBills: [], otherCharges: [], payments: [], allocations: [], deposits: [], receipts: [], documents: [], auditLog: [] };
const fieldClass = "h-11 w-full rounded-xl border border-input bg-white px-3 text-[15px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const textAreaClass = "min-h-24 w-full rounded-xl border border-input bg-white px-3 py-2 text-[15px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export default function RentFlowApp({ ownerName, ownerEmail }: { ownerName: string; ownerEmail: string }) {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [data, setData] = useState<DataState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<DialogKey>(null);
  const [context, setContext] = useState<Row>({});
  const [month, setMonth] = useState(localMonth());
  const [propertyFilter, setPropertyFilter] = useState("");
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/state", { cache: "no-store" }); const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load RentFlow."); setData(body);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load RentFlow."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const open = (key: DialogKey, value: Row = {}) => { setContext(value); setDialog(key); };
  const runAction = async (action: string, payload: Row, success: string) => {
    const res = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
    const body = await res.json(); if (!res.ok) throw new Error(body.error || "Action failed.");
    toast.success(success); await load(); return body.result;
  };
  const model = useMemo(() => derive(data, month, propertyFilter), [data, month, propertyFilter]);
  const searchResults = useMemo(() => globalSearch(data, search), [data, search]);
  const activeLabel = pages.find((p) => p.key === page)?.label ?? "RentFlow";
  const changeMonth = (delta: number) => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 1 + delta, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };

  return (
    <SidebarProvider style={{ "--sidebar-width": "15rem" } as React.CSSProperties}>
      <Toaster richColors position="top-right" />
      <Sidebar collapsible="offcanvas" className="border-r-0">
        <SidebarHeader className="px-4 pb-5 pt-5">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-[13px] bg-gradient-to-br from-[#8f84f2] to-[#6558d3] shadow-lg shadow-violet-950/25"><Home className="size-5 text-white" /></div><div><div className="text-lg font-bold tracking-tight text-white">RentFlow</div><div className="text-xs text-slate-400">Monthly rental ledger</div></div></div>
        </SidebarHeader>
        <SidebarContent><SidebarGroup><SidebarGroupContent><SidebarMenu className="gap-1 px-2">
          {pages.map(({ key, label, icon: Icon }) => <SidebarMenuItem key={key}><SidebarMenuButton isActive={page === key} onClick={() => setPage(key)} className="h-10 rounded-xl px-3 text-sm data-[active=true]:bg-[#8176eb] data-[active=true]:text-white"><Icon className="size-[18px]" /><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}
        </SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
        <SidebarFooter className="p-4"><div className="rounded-2xl border border-white/10 bg-white/[.04] p-3"><div className="flex items-center gap-2 text-sm font-medium text-white"><ShieldCheck className="size-4 text-emerald-400" /> Protected workspace</div><div className="mt-1 truncate text-xs text-slate-400">{data?.workspace?.name || ownerEmail}</div></div><a href="/signout-with-chatgpt?return_to=/" target="_top" className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-slate-300 hover:bg-white/10"><LogOut className="size-4" /> Sign out</a></SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-[#f4f6fb] pb-20 md:pb-0">
        <header data-no-print className="sticky top-0 z-20 flex h-[74px] items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl md:px-7">
          <SidebarTrigger className="size-10 md:hidden" />
          <div className="min-w-0"><h1 className="truncate text-lg font-bold text-slate-900">{activeLabel}</h1><p className="hidden text-xs text-slate-500 sm:block">{page === "dashboard" ? `Welcome back, ${firstName(ownerName)}` : pageHint(page)}</p></div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden lg:block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Search RentFlow" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tenant, room, receipt…" className="h-10 w-72 rounded-xl bg-slate-50 pl-9" />{search && <SearchPopover results={searchResults} onOpen={(r: Row) => { setSearch(""); if (r.type === "tenant") { setPage("tenants"); open("ledger", r.row); } else setPage(r.page); }} />}</div>
            <Button variant="outline" className="hidden h-10 rounded-xl xl:flex" onClick={() => open("reading")}><Gauge /> Meter reading</Button>
            <Button className="h-10 rounded-xl shadow-sm" onClick={() => open("payment")}><Plus /> <span className="hidden sm:inline">Record payment</span></Button>
          </div>
        </header>
        <section className="mx-auto w-full max-w-[1500px] px-4 py-5 md:px-7 md:py-7">
          {loading ? <LoadingView /> : error ? <ErrorView error={error} retry={load} /> : <>
            {page !== "settings" && <PeriodBar month={month} setMonth={setMonth} changeMonth={changeMonth} properties={data.properties} propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter} onSearch={() => open("ledger", { searchOnly: true })} />}
            {page === "dashboard" && <Dashboard data={data} model={model} month={month} open={open} setPage={setPage} runAction={runAction} />}
            {page === "properties" && <PropertiesPage data={data} model={model} open={open} runAction={runAction} />}
            {page === "rooms" && <RoomsPage data={data} model={model} open={open} runAction={runAction} />}
            {page === "tenants" && <TenantsPage data={data} model={model} open={open} />}
            {page === "rent" && <RentPage data={data} model={model} month={month} propertyFilter={propertyFilter} open={open} runAction={runAction} />}
            {page === "electricity" && <ElectricityPage data={data} model={model} month={month} open={open} />}
            {page === "payments" && <PaymentsPage data={data} model={model} open={open} runAction={runAction} />}
            {page === "reports" && <ReportsPage data={data} model={model} month={month} />}
            {page === "documents" && <DocumentsPage data={data} open={open} reload={load} />}
            {page === "settings" && <SettingsPage data={data} ownerEmail={ownerEmail} open={open} />}
          </>}
        </section>
      </SidebarInset>
      <MobileNav page={page} setPage={setPage} />
      <ActionDialog kind={dialog} context={context} data={data} month={month} close={() => setDialog(null)} runAction={runAction} reload={load} model={model} />
    </SidebarProvider>
  );
}

function PeriodBar({ month, setMonth, changeMonth, properties, propertyFilter, setPropertyFilter, onSearch }: any) {
  return <div data-no-print className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm shadow-slate-200/40">
    <Button variant="ghost" size="icon" className="size-10 rounded-xl" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft /></Button>
    <label className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" /><input aria-label="Billing month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${fieldClass} w-[170px] pl-9 font-semibold`} /></label>
    <Button variant="ghost" size="icon" className="size-10 rounded-xl" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight /></Button>
    <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
    <select aria-label="Property filter" value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className={`${fieldClass} w-auto min-w-[170px]`}><option value="">All properties</option>{properties.filter((p: Row) => p.active).map((p: Row) => <option value={p.id} key={p.id}>{p.name}</option>)}</select>
    <Button variant="ghost" className="ml-auto h-10 rounded-xl lg:hidden" onClick={onSearch}><Search /> Search</Button>
  </div>;
}

function Dashboard({ data, model, month, open, setPage, runAction }: any) {
  if (!data.properties.length) return <EmptyStart open={open} />;
  const cards = [
    ["Expected rent", model.expectedRent, IndianRupee, "violet"], ["Rent collected", model.rentCollected, CheckCircle2, "green"],
    ["Rent pending", model.rentPending, Clock3, "orange"], ["Electricity billed", model.electricityBilled, Zap, "blue"],
    ["Total pending", model.totalPending, CircleAlert, "red"], ["Occupancy", `${model.occupied}/${model.activeRooms}`, Home, "navy"],
  ];
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{cards.map(([label, value, Icon, tone]: any) => <MetricCard key={label} label={label} value={typeof value === "number" ? money(value) : value} icon={Icon} tone={tone} />)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
      <Card className="overflow-hidden"><div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Collection health</h2><p className="text-sm text-slate-500">Saved allocations for {formatMonth(month)}</p></div><Button size="sm" variant="outline" className="ml-auto rounded-lg" onClick={() => setPage("rent")}>Open rent ledger <ArrowUpRight /></Button></div><div className="space-y-6 p-5"><CollectionBar label="Rent" collected={model.rentCollected} total={model.expectedRent} color="violet" /><CollectionBar label="Electricity" collected={model.electricityCollected} total={model.electricityBilled} color="blue" /></div></Card>
      <div className="rounded-2xl bg-[#171d31] p-5 text-white shadow-lg shadow-slate-300"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-violet-300">Month close</p><h2 className="mt-2 text-xl font-bold">{formatMonth(month)}</h2></div><div className="rounded-xl bg-white/10 p-2"><CalendarDays className="size-5" /></div></div><div className="mt-6 grid grid-cols-2 gap-3 text-sm"><DarkStat label="Rent charges" value={model.rentRows.filter((r: Row) => r.charge).length} /><DarkStat label="Missing rent" value={model.rentRows.filter((r: Row) => !r.charge).length} /><DarkStat label="Meter readings" value={model.electricRows.filter((r: Row) => r.reading).length} /><DarkStat label="Missing readings" value={model.electricRows.filter((r: Row) => !r.reading).length} /></div><Button className="mt-5 w-full rounded-xl bg-white text-slate-900 hover:bg-slate-100" onClick={() => runAction("generate_rent", { billingMonth: month, propertyId: model.propertyFilter }, "Monthly rent generation finished")}>Generate missing rent</Button></div>
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.55fr_.85fr]"><Card><SectionHead title="Pending tenancies" subtitle="Old dues stay linked to their original charges" action={<Button size="sm" onClick={() => open("payment")}><Plus /> Record payment</Button>} /><ResponsiveTable heads={["Room", "Tenant", "Rent", "Electricity", "Previous", "Outstanding", "Status", ""]} rows={model.pendingRows.map((r: Row) => [r.room, r.tenant, money(r.rent), money(r.electricity), money(r.previous), <b key="v">{money(r.total)}</b>, <Status key="s" value={r.overdue ? "overdue" : "unpaid"} />, <Button key="a" variant="ghost" size="sm" onClick={() => open("payment", { tenancyId: r.tenancyId })}>Pay</Button>])} empty="No unpaid balances for this view." /></Card>
      <Card><SectionHead title="Recent activity" subtitle="Every event comes from saved actions" />{data.auditLog.length ? <div className="divide-y divide-slate-100 px-5 pb-3">{data.auditLog.slice(0, 7).map((a: Row) => <div className="flex gap-3 py-3" key={a.id}><div className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg bg-violet-50 text-primary"><Activity className="size-3.5" /></div><div><p className="text-sm font-medium text-slate-800">{a.summary}</p><p className="mt-1 text-xs text-slate-400">{formatDateTime(a.created_at)}</p></div></div>)}</div> : <MiniEmpty icon={Activity} text="Activity will appear after your first saved action." />}</Card></div>
  </div>;
}

function PropertiesPage({ data, model, open, runAction }: any) {
  return <div className="space-y-5"><PageHead title="Properties" subtitle="Defaults apply to future records; historical bills stay frozen." action={<Button onClick={() => open("property")}><Plus /> Add property</Button>} />
    {data.properties.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.properties.map((p: Row) => {
      const rooms = data.rooms.filter((r: Row) => r.property_id === p.id && r.active); const occupied = rooms.filter((r: Row) => r.status === "occupied").length; const summary = model.propertySummaries[p.id] ?? { expected: 0, collected: 0, outstanding: 0 };
      return <Card key={p.id} className={!p.active ? "opacity-60" : ""}><div className="p-5"><div className="flex items-start gap-3"><div className="grid size-11 place-items-center rounded-xl bg-violet-50 text-primary"><Building2 /></div><div className="min-w-0 flex-1"><h3 className="truncate font-bold text-slate-900">{p.name}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.address || "No address added"}</p></div><Status value={p.active ? "active" : "archived"} /></div><div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center"><TinyStat label="Rooms" value={rooms.length} /><TinyStat label="Occupied" value={occupied} /><TinyStat label="Vacant" value={Math.max(0, rooms.length - occupied)} /></div><div className="mt-4 flex justify-between text-sm"><span className="text-slate-500">Month outstanding</span><b>{money(summary.outstanding)}</b></div><div className="mt-4 flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={() => open("property", p)}>Edit</Button>{p.active ? <ConfirmButton label="Archive" description="This hides the property from active lists. Historical records remain available." onConfirm={() => runAction("archive_property", { id: p.id }, "Property archived")} /> : null}<ConfirmButton label="Delete" destructive description="Only an entirely unused property can be deleted." onConfirm={() => runAction("delete_property", { id: p.id }, "Unused property deleted")} /></div></div></Card>;
    })}</div> : <EmptyPanel icon={Building2} title="No properties yet" text="Add your first property, then create its rooms." action={<Button onClick={() => open("property")}><Plus /> Add your first property</Button>} />}
  </div>;
}

function RoomsPage({ data, model, open, runAction }: any) {
  return <div className="space-y-5"><PageHead title="Rooms" subtitle="One active tenancy per room. Occupancy changes atomically with move-in and move-out." action={<Button onClick={() => open("room")} disabled={!data.properties.some((p: Row) => p.active)}><Plus /> Add room</Button>} /><Card><ResponsiveTable heads={["Room", "Property", "Floor", "Meter", "Tenant", "Outstanding", "Status", "Actions"]} rows={data.rooms.map((r: Row) => { const t = model.activeByRoom[r.id]; const tenant = t ? model.tenantById[t.tenant_id] : null; return [<b key="r">{r.room_number}</b>, model.propertyById[r.property_id]?.name, r.floor || "—", r.meter_number || "—", tenant?.full_name || "Vacant", money(t ? model.balanceByTenancy[t.id] || 0 : 0), <Status key="s" value={r.active ? r.status : "archived"} />, <div key="a" className="flex gap-1"><Button variant="ghost" size="sm" disabled={!!t || !r.active} onClick={() => open("tenancy", { roomId: r.id, propertyId: r.property_id })}>Move in</Button>{r.active && <ConfirmButton label="Archive" description="Rooms with history are archived, never erased." onConfirm={() => runAction("archive_room", { id: r.id }, "Room archived")} />}<ConfirmButton label="Delete" destructive description="Only a room with no tenancy history can be deleted." onConfirm={() => runAction("delete_room", { id: r.id }, "Unused room deleted")} /></div>]; })} empty="No rooms yet. Add a property first, then create its rentable rooms." /></Card></div>;
}

function TenantsPage({ data, model, open }: any) {
  return <div className="space-y-5"><PageHead title="Tenants" subtitle="People are kept separate from their room-by-room occupancy history." action={<Button onClick={() => open("tenant")}><Plus /> Add tenant</Button>} />
    {data.tenants.length ? <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{data.tenants.map((tenant: Row) => {
      const tenancies = data.tenancies.filter((t: Row) => t.tenant_id === tenant.id); const active = tenancies.find((t: Row) => ["active", "notice"].includes(t.status)); const room = active ? model.roomById[active.room_id] : null; const prop = active ? model.propertyById[active.property_id] : null;
      return <Card key={tenant.id}><div className="p-5"><div className="flex items-start gap-3"><div className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-600"><UserRound /></div><div className="min-w-0 flex-1"><h3 className="font-bold text-slate-900">{tenant.full_name}</h3><p className="mt-1 text-sm text-slate-500">{tenant.phone || "No mobile number"}</p></div><Status value={active ? active.status : "inactive"} /></div>{active ? <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/70 p-3 text-sm"><div className="flex justify-between"><span>{prop?.name} · Room {room?.room_number}</span><b>{money(model.balanceByTenancy[active.id] || 0)} due</b></div></div> : <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No active tenancy · {tenancies.length} historical stay(s)</div>}<div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => open("ledger", tenant)}>Ledger</Button>{active ? <><Button size="sm" variant="outline" onClick={() => open("payment", { tenancyId: active.id })}>Payment</Button><Button size="sm" variant="ghost" onClick={() => open("other", { tenancyId: active.id })}>Charge</Button><Button size="sm" variant="ghost" onClick={() => open("deposit", { tenancyId: active.id })}>Deposit</Button><Button size="sm" variant="ghost" onClick={() => open("rate", { tenancyId: active.id })}>Rent rate</Button>{active.status === "active" && <Button size="sm" variant="ghost" onClick={() => open("notice", { tenancyId: active.id })}>Notice</Button>}<Button size="sm" variant="ghost" onClick={() => open("moveout", { tenancyId: active.id })}>Move out</Button></> : <Button size="sm" onClick={() => open("tenancy", { tenantId: tenant.id })}>Move in</Button>}</div></div></Card>;
    })}</div> : <EmptyPanel icon={UsersRound} title="No tenants yet" text="Create a person record first. Room history will live in separate tenancies." action={<Button onClick={() => open("tenant")}><Plus /> Add tenant</Button>} />}
  </div>;
}

function RentPage({ model, month, propertyFilter, open, runAction }: any) {
  const exportRows = model.rentRows.map((r: Row) => ({ tenant: r.tenant, property: r.property, room: r.room, month, charge: (r.charge?.amount_paise || 0) / 100, paid: r.paid / 100, balance: r.balance / 100, status: r.status }));
  return <div className="space-y-5"><PageHead title="Monthly rent ledger" subtitle="Generation is idempotent and freezes the effective rent rate on each charge." action={<div className="flex gap-2"><Button variant="outline" onClick={() => downloadCsv(`rent-${month}.csv`, exportRows)}><Download /> CSV</Button><Button onClick={() => runAction("generate_rent", { billingMonth: month, propertyId: propertyFilter }, "Rent generation complete")}><RefreshCw /> Generate month</Button></div>} /><div className="grid gap-3 sm:grid-cols-3"><MiniMetric label="Expected" value={money(model.expectedRent)} /><MiniMetric label="Collected" value={money(model.rentCollected)} positive /><MiniMetric label="Pending" value={money(model.rentPending)} warning /></div><Card><ResponsiveTable heads={["Room", "Tenant", "Rent", "Paid", "Balance", "Due date", "Status", "Actions"]} rows={model.rentRows.map((r: Row) => [r.room, r.tenant, r.charge ? money(r.charge.amount_paise) : "Not generated", money(r.paid), <b key="b">{money(r.balance)}</b>, r.charge?.due_date ? formatDate(r.charge.due_date) : "—", <Status key="s" value={r.status} />, <div key="a" className="flex gap-1"><Button size="sm" variant="ghost" disabled={!r.charge} onClick={() => open("bill", r)}>Bill</Button><Button size="sm" variant="ghost" onClick={() => open("payment", { tenancyId: r.tenancy.id })}>Pay</Button></div>])} empty="No active tenancies intersect this billing month." /></Card></div>;
}

function ElectricityPage({ model, open }: any) {
  return <div className="space-y-5"><PageHead title="Electricity ledger" subtitle="Readings preserve the meter inputs and bills freeze the rate used." action={<Button onClick={() => open("reading")} disabled={!model.activeTenancies.length}><Plus /> Add meter reading</Button>} /><div className="grid gap-3 sm:grid-cols-3"><MiniMetric label="Billed" value={money(model.electricityBilled)} /><MiniMetric label="Collected" value={money(model.electricityCollected)} positive /><MiniMetric label="Pending" value={money(model.electricityPending)} warning /></div><Card><ResponsiveTable heads={["Room", "Tenant", "Meter", "Previous", "Current", "Units", "Rate", "Fixed", "Total", "Status"]} rows={model.electricRows.map((r: Row) => [r.room, r.tenant, r.meter || "—", r.reading?.previous_reading ?? "—", r.reading?.current_reading ?? "—", r.reading?.units ?? "—", r.bill ? money(r.bill.rate_paise_per_unit) + "/unit" : "—", r.bill ? money(r.bill.fixed_charge_paise) : "—", r.bill ? money(r.bill.total_paise) : "—", <div key="s" className="flex items-center gap-1"><Status value={r.reading?.status || "missing"} />{r.reading?.status === "draft" && <Button size="sm" variant="ghost" onClick={() => open("reading", { readingId: r.reading.id, finalizeExisting: true })}>Finalize</Button>}</div>])} empty="No active tenancies for this month." /></Card><div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><b>Formula:</b> units = current − previous; total = units × saved rate + fixed charge.</div></div>;
}

function PaymentsPage({ data, model, open, runAction }: any) {
  const exportRows = data.payments.map((p: Row) => { const t = model.tenancyById[p.tenancy_id]; return { date: p.payment_date, tenant: model.tenantById[p.tenant_id]?.full_name, room: model.roomById[t?.room_id]?.room_number, amount: p.amount_paise / 100, mode: p.mode, reference: p.reference, allocated: (model.allocatedByPayment[p.id] || 0) / 100, unallocated: (p.amount_paise - (model.allocatedByPayment[p.id] || 0)) / 100, status: p.status }; });
  return <div className="space-y-5"><PageHead title="Payments" subtitle="Payments and charge allocations are stored separately for full reconciliation." action={<div className="flex gap-2"><Button variant="outline" onClick={() => downloadCsv("payments.csv", exportRows)}><Download /> CSV</Button><Button onClick={() => open("payment")}><Plus /> Record payment</Button></div>} /><Card><ResponsiveTable heads={["Date", "Tenant / room", "Amount", "Mode", "Reference", "Allocated", "Credit", "Receipt", "Status"]} rows={data.payments.map((p: Row) => { const t = model.tenancyById[p.tenancy_id]; const receipt = data.receipts.find((r: Row) => r.payment_id === p.id); const allocated = model.allocatedByPayment[p.id] || 0; return [formatDate(p.payment_date), <div key="t"><b>{model.tenantById[p.tenant_id]?.full_name}</b><div className="text-xs text-slate-500">Room {model.roomById[t?.room_id]?.room_number || "—"}</div></div>, <b key="a">{money(p.amount_paise)}</b>, titleCase(p.mode), p.reference || "—", money(allocated), money(p.amount_paise - allocated), receipt ? <Button key="r" variant="ghost" size="sm" onClick={() => open("bill", { receipt })}>{receipt.receipt_number}</Button> : <Button key="r" variant="ghost" size="sm" disabled={p.status === "reversed"} onClick={() => runAction("issue_receipt", { paymentId: p.id }, "Receipt issued")}>Issue</Button>, <div key="s" className="flex items-center gap-1"><Status value={p.status} />{p.status !== "reversed" && <ConfirmButton label="Reverse" destructive description="Allocations will be released and any receipt will be marked void. This action is audited." askReason onConfirm={(reason: string) => runAction("reverse_payment", { paymentId: p.id, reason }, "Payment reversed")} />}</div>]; })} empty="No payments recorded yet." /></Card></div>;
}

function ReportsPage({ data, model, month }: any) {
  const cards = [{ title: "Monthly collection", value: money(model.rentCollected + model.electricityCollected), note: `${formatMonth(month)} rent + electricity allocations`, icon: BarChart3 }, { title: "Tenant outstanding", value: money(model.totalPending), note: `${model.pendingRows.length} tenancy balance(s)`, icon: CircleAlert }, { title: "Security deposits held", value: money(model.depositHeld), note: "Excluded from rental income", icon: ShieldCheck }, { title: "Vacant rooms", value: model.activeRooms - model.occupied, note: `${model.activeRooms} rentable active rooms`, icon: Home }];
  return <div className="space-y-5"><PageHead title="Reports" subtitle="All summaries use saved charges and allocations without double-counting." action={<Button variant="outline" onClick={() => downloadCsv(`tenant-outstanding-${month}.csv`, model.pendingRows.map((r: Row) => ({ tenant: r.tenant, room: r.room, rent: r.rent / 100, electricity: r.electricity / 100, previous: r.previous / 100, total: r.total / 100 })))}><Download /> Export dues</Button>} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map((c) => <Card key={c.title}><div className="p-5"><div className="grid size-10 place-items-center rounded-xl bg-violet-50 text-primary"><c.icon /></div><p className="mt-5 text-sm font-medium text-slate-500">{c.title}</p><p className="mt-1 text-2xl font-bold text-slate-900">{c.value}</p><p className="mt-2 text-xs text-slate-500">{c.note}</p></div></Card>)}</div><Card><SectionHead title="Property collection" subtitle="Expected, collected and outstanding for the selected month" /><ResponsiveTable heads={["Property", "Expected", "Collected", "Outstanding", "Occupancy"]} rows={data.properties.filter((p: Row) => p.active).map((p: Row) => { const s = model.propertySummaries[p.id] || {}; const rooms = data.rooms.filter((r: Row) => r.property_id === p.id && r.active); return [p.name, money(s.expected || 0), money(s.collected || 0), money(s.outstanding || 0), `${rooms.filter((r: Row) => r.status === "occupied").length}/${rooms.length}`]; })} empty="Add a property to begin reporting." /></Card></div>;
}

function DocumentsPage({ data, open, reload }: any) {
  const remove = async (id: string) => { const res = await fetch(`/api/documents/${id}`, { method: "DELETE" }); const body = await res.json(); if (!res.ok) throw new Error(body.error); toast.success("Document deleted"); reload(); };
  return <div className="space-y-5"><PageHead title="Documents" subtitle="Original files stay in private object storage and open only on request." action={<Button onClick={() => open("upload")}><Upload /> Upload document</Button>} /><Card><ResponsiveTable heads={["File", "Category", "Related to", "Size", "Uploaded", "Actions"]} rows={data.documents.map((d: Row) => [<div key="f" className="flex items-center gap-2"><FileText className="size-4 text-primary" /><b>{d.filename}</b></div>, titleCase(d.type), data.tenants.find((t: Row) => t.id === d.tenant_id)?.full_name || data.rooms.find((r: Row) => r.id === d.room_id)?.room_number || "General", formatBytes(d.size), formatDate(d.created_at), <div key="a" className="flex gap-1"><Button asChild size="sm" variant="ghost"><a href={`/api/documents/${d.id}`}><Download /> Open</a></Button><ConfirmButton label="Delete" destructive description="The stored file and its metadata will be permanently removed." onConfirm={() => remove(d.id)} /></div>])} empty="No private documents uploaded." /></Card></div>;
}

function SettingsPage({ data, ownerEmail, open }: any) {
  const s = data.settings || {};
  return <div className="space-y-5"><PageHead title="Settings" subtitle="Configuration changes affect future records only." action={<Button onClick={() => open("settings", s)}>Edit settings</Button>} /><div className="grid gap-5 lg:grid-cols-2"><Card><SectionHead title="General" /><Definition rows={[["Landlord / display name", s.landlord_name || "Not set"], ["Currency", "INR"], ["Timezone", s.timezone], ["Rent due day", String(s.default_rent_due_day || 10)]]} /></Card><Card><SectionHead title="Account & security" subtitle="Identity is verified before this workspace can be opened." /><Definition rows={[["Workspace", data.workspace?.name || "RentFlow workspace"], ["Account", ownerEmail], ["Access", "Owner"], ["Sign-in protection", "Managed by ChatGPT"]]} /></Card><Card><SectionHead title="Payment instructions" /><Definition rows={[["UPI ID", s.upi_id || "Not configured"], ["Receipt prefix", s.receipt_prefix || "RF-RCPT"], ["Bill prefix", s.bill_prefix || "RF-BILL"], ["Bill footer", s.bill_footer || "Not configured"]]} /></Card><Card><SectionHead title="Data export" subtitle="Structured data only; private document bytes are excluded." /><div className="p-5 pt-0"><Button variant="outline" onClick={() => downloadJson("rentflow-backup.json", data)}><Download /> Export all structured data</Button></div></Card><Card className="border-red-200"><SectionHead title="Danger zone" subtitle="A complete wipe removes records and private stored files without deleting your account." /><div className="p-5 pt-0"><Button variant="destructive" onClick={() => open("erase")}><Trash2 /> Erase all RentFlow data</Button></div></Card></div></div>;
}

function ActionDialog({ kind, context, data, month, close, runAction, reload, model }: any) {
  const [saving, setSaving] = useState(false); const [formError, setFormError] = useState("");
  useEffect(() => { setFormError(""); setSaving(false); }, [kind]);
  if (!kind) return null;
  if (kind === "bill") return <BillDialog open context={context} data={data} model={model} close={close} />;
  if (kind === "ledger") return <LedgerDialog open context={context} data={data} model={model} close={close} />;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setSaving(true); setFormError("");
    try {
      const fd = new FormData(e.currentTarget); const v = Object.fromEntries(fd.entries()); let action = ""; let payload: Row = {}; let success = "Saved";
      if (kind === "property") { action = context.id ? "update_property" : "create_property"; payload = { ...v, id: context.id, defaultRentDueDay: Number(v.defaultRentDueDay), defaultElectricityRatePaise: toPaise(v.defaultElectricityRate), defaultElectricityFixedChargePaise: toPaise(v.defaultElectricityFixedCharge) }; success = context.id ? "Property updated" : "Property created"; }
      if (kind === "room") { action = "create_room"; payload = v; success = "Room created"; }
      if (kind === "tenant") { action = "create_tenant"; payload = v; success = "Tenant created"; }
      if (kind === "tenancy") { action = "activate_tenancy"; payload = { ...v, monthlyRentPaise: toPaise(v.monthlyRent), rentDueDay: Number(v.rentDueDay), securityDepositRequiredPaise: toPaise(v.securityDepositRequired), securityDepositReceivedPaise: toPaise(v.securityDepositReceived), openingBalancePaise: toPaise(v.openingBalance), electricityRatePaise: toPaise(v.electricityRate), electricityFixedChargePaise: toPaise(v.electricityFixedCharge) }; success = "Tenancy activated and room occupied"; }
      if (kind === "payment") {
        const allocationMode = String(v.allocationMode || "automatic");
        const allocations = Array.from(fd.entries()).filter(([key]) => key.startsWith("allocation:")).map(([key, value]) => { const [, chargeType, chargeId] = key.split(":"); return { chargeType, chargeId, amountPaise: toPaise(value) }; }).filter((a) => a.amountPaise > 0);
        action = "record_payment"; payload = { ...v, amountPaise: toPaise(v.amount), allocationMode, allocations }; success = "Payment recorded and allocated";
      }
      if (kind === "reading" && context.finalizeExisting) { action = "finalize_electricity"; payload = { readingId: context.readingId, dueDate: v.dueDate }; success = "Electricity bill finalized"; }
      else if (kind === "reading") { action = "record_electricity"; payload = { ...v, previousReading: Number(v.previousReading), currentReading: Number(v.currentReading), finalize: v.finalize === "on" }; success = v.finalize === "on" ? "Reading saved and bill finalized" : "Draft reading saved"; }
      if (kind === "other") { action = "create_other_charge"; payload = { ...v, amountPaise: toPaise(v.amount) * (v.kind === "credit" ? -1 : 1) }; success = v.kind === "credit" ? "Credit recorded" : "Charge recorded"; }
      if (kind === "deposit") { action = "deposit_transaction"; payload = { ...v, amountPaise: toPaise(v.amount) }; success = "Deposit ledger updated"; }
      if (kind === "rate") { action = "update_rent_rate"; payload = { ...v, amountPaise: toPaise(v.amount) }; success = "Future rent rate saved"; }
      if (kind === "notice") { action = "set_notice"; payload = v; success = "Notice recorded"; }
      if (kind === "moveout") { action = "move_out"; payload = v; success = "Tenancy closed; history retained"; }
      if (kind === "settings") { action = "update_settings"; payload = { ...v, defaultRentDueDay: Number(v.defaultRentDueDay), defaultElectricityRatePaise: toPaise(v.defaultElectricityRate), defaultElectricityFixedChargePaise: toPaise(v.defaultElectricityFixedCharge), maxFileSizeMb: Number(v.maxFileSizeMb) }; success = "Settings updated"; }
      if (kind === "erase") { action = "erase_all"; payload = v; success = "RentFlow data erased"; }
      if (kind === "upload") { const res = await fetch("/api/documents", { method: "POST", body: fd }); const body = await res.json(); if (!res.ok) throw new Error(body.error || "Upload failed"); toast.success("Document uploaded privately"); await reload(); close(); return; }
      await runAction(action, payload, success); close();
    } catch (e) { setFormError(e instanceof Error ? e.message : "Could not save"); }
    finally { setSaving(false); }
  };
  const spec = dialogSpec(kind, context);
  return <Dialog open onOpenChange={(o) => !o && close()}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{spec.title}</DialogTitle><DialogDescription>{spec.description}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><DialogFields kind={kind} context={context} data={data} month={month} model={model} />{formError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>}<DialogFooter><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" variant={kind === "erase" ? "destructive" : "default"} disabled={saving}>{saving ? "Saving…" : spec.submit}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function DialogFields({ kind, context, data, month, model }: any) {
  const activeProperties = data.properties.filter((p: Row) => p.active);
  const activeRooms = data.rooms.filter((r: Row) => r.active && !model.activeByRoom[r.id]);
  const activeTenancies = model.activeTenancies;
  if (kind === "property") return <><Grid><Field label="Property name" name="name" required defaultValue={context.name} /><Field label="Address" name="address" defaultValue={context.address} /><Field label="Rent due day" name="defaultRentDueDay" type="number" min="1" max="28" required defaultValue={context.default_rent_due_day ?? 10} /><MoneyField label="Default electricity ₹/unit" name="defaultElectricityRate" defaultValue={fromPaise(context.default_electricity_rate_paise)} /><MoneyField label="Default fixed charge" name="defaultElectricityFixedCharge" defaultValue={fromPaise(context.default_electricity_fixed_charge_paise)} /></Grid><TextField label="Notes" name="notes" defaultValue={context.notes} /></>;
  if (kind === "room") return <><Grid><SelectField label="Property" name="propertyId" required defaultValue={context.propertyId} options={activeProperties.map((p: Row) => [p.id, p.name])} /><Field label="Room number" name="roomNumber" required /><Field label="Floor (optional)" name="floor" /><Field label="Meter number" name="meterNumber" /><SelectField label="Initial status" name="status" options={[["vacant", "Vacant"], ["reserved", "Reserved"], ["maintenance", "Maintenance"]]} /></Grid><TextField label="Notes" name="notes" /></>;
  if (kind === "tenant") return <><Grid><Field label="Full name" name="fullName" required /><Field label="Mobile number" name="phone" /><Field label="Alternate number" name="alternatePhone" /><Field label="Email" name="email" type="email" /><SelectField label="ID type" name="idType" options={[["", "Not provided"], ["aadhaar", "Aadhaar"], ["passport", "Passport"], ["driving_licence", "Driving licence"], ["other", "Other"]]} /><Field label="ID number (stored masked)" name="idNumber" /><Field label="Emergency contact" name="emergencyContactName" /><Field label="Emergency phone" name="emergencyContactPhone" /></Grid><TextField label="Permanent address" name="permanentAddress" /><TextField label="Notes" name="notes" /></>;
  if (kind === "tenancy") {
    const chosenRoom = activeRooms.find((r: Row) => r.id === context.roomId); const chosenProp = activeProperties.find((p: Row) => p.id === (context.propertyId || chosenRoom?.property_id));
    return <><Grid><SelectField label="Property" name="propertyId" required defaultValue={context.propertyId || chosenRoom?.property_id} options={activeProperties.map((p: Row) => [p.id, p.name])} /><SelectField label="Available room" name="roomId" required defaultValue={context.roomId} options={activeRooms.map((r: Row) => [r.id, `${model.propertyById[r.property_id]?.name} · ${r.room_number}`])} /><SelectField label="Tenant" name="tenantId" required defaultValue={context.tenantId} options={data.tenants.map((t: Row) => [t.id, t.full_name])} /><Field label="Move-in date" name="moveInDate" type="date" required defaultValue={today()} /><Field label="Rent start date" name="rentStartDate" type="date" required defaultValue={today()} /><MoneyField label="Monthly rent" name="monthlyRent" required /><Field label="Rent due day" name="rentDueDay" type="number" min="1" max="28" required defaultValue={chosenProp?.default_rent_due_day ?? 10} /><MoneyField label="Deposit required" name="securityDepositRequired" /><MoneyField label="Deposit received now" name="securityDepositReceived" /><MoneyField label="Opening outstanding" name="openingBalance" /><MoneyField label="Electricity ₹/unit" name="electricityRate" defaultValue={fromPaise(chosenProp?.default_electricity_rate_paise)} /><MoneyField label="Electricity fixed charge" name="electricityFixedCharge" defaultValue={fromPaise(chosenProp?.default_electricity_fixed_charge_paise)} /><Field label="Initial meter reading" name="initialMeterReading" type="number" step="0.001" min="0" /></Grid><ReviewNote>Activation creates effective-dated rent and electricity rates and marks the room Occupied. No past bills are invented.</ReviewNote></>;
  }
  if (kind === "payment") return <PaymentFields context={context} activeTenancies={activeTenancies} model={model} />;
  if (kind === "reading" && context.finalizeExisting) return <><Field label="Due date" name="dueDate" type="date" defaultValue={today()} /><ReviewNote>Finalizing freezes the saved units, effective rate and fixed charge. Historical finalized bills remain unchanged.</ReviewNote></>;
  if (kind === "reading") return <ReadingFields context={context} data={data} month={month} activeTenancies={activeTenancies} model={model} />;
  if (kind === "other") return <><Grid><input type="hidden" name="tenancyId" value={context.tenancyId} /><SelectField label="Entry type" name="kind" options={[["charge", "Charge"], ["credit", "Credit / waiver"]]} /><SelectField label="Charge category" name="chargeType" options={[["maintenance", "Maintenance"], ["damage", "Damage"], ["key_replacement", "Key replacement"], ["parking", "Parking"], ["cleaning", "Cleaning"], ["other", "Other"]]} /><MoneyField label="Amount" name="amount" required /><Field label="Date" name="chargeDate" type="date" required defaultValue={today()} /></Grid><TextField label="Description" name="description" required /></>;
  if (kind === "deposit") return <><input type="hidden" name="tenancyId" value={context.tenancyId} /><Grid><SelectField label="Transaction" name="type" options={[["received", "Received"], ["adjustment", "Adjustment"], ["deduction", "Deduction"], ["refund", "Refund"]]} /><MoneyField label="Amount" name="amount" required /><Field label="Date" name="date" type="date" required defaultValue={today()} /></Grid><TextField label="Description" name="description" /><ReviewNote>Deductions and refunds cannot exceed the deposit currently held.</ReviewNote></>;
  if (kind === "rate") return <><input type="hidden" name="tenancyId" value={context.tenancyId} /><Grid><MoneyField label="New monthly rent" name="amount" required /><Field label="Effective from" name="effectiveFrom" type="date" required defaultValue={firstNextMonth()} /></Grid><ReviewNote>Existing monthly charges will not change. A new effective-dated rate is used only for future generation.</ReviewNote></>;
  if (kind === "notice") return <><input type="hidden" name="tenancyId" value={context.tenancyId} /><Field label="Notice date" name="noticeDate" type="date" required defaultValue={today()} /></>;
  if (kind === "moveout") return <><input type="hidden" name="tenancyId" value={context.tenancyId} /><Field label="Move-out date" name="moveOutDate" type="date" required defaultValue={today()} /><ReviewNote>Before closing, finalize the meter reading, review open charges, and record deposit deductions/refunds. Closing frees the room and retains every historical record.</ReviewNote></>;
  if (kind === "upload") return <><Grid><SelectField label="Category" name="type" options={[["tenant_id", "Tenant ID"], ["rent_agreement", "Rent agreement"], ["police_verification", "Police verification"], ["tenant_photo", "Tenant photo"], ["meter_photo", "Meter photo"], ["payment_proof", "Payment proof"], ["receipt_attachment", "Receipt attachment"], ["property_document", "Property document"], ["other", "Other"]]} /><SelectField label="Related tenant" name="tenantId" options={[["", "General / none"], ...data.tenants.map((t: Row) => [t.id, t.full_name])]} /></Grid><label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">File</span><input className={`${fieldClass} h-auto py-2`} type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.docx" /></label><ReviewNote>Files are private, limited to {data.settings.max_file_size_mb || 20} MB, and never exposed through a public storage URL.</ReviewNote></>;
  if (kind === "settings") { const s = context; return <><Grid><Field label="Landlord / display name" name="landlordName" defaultValue={s.landlord_name} /><Field label="Timezone" name="timezone" defaultValue={s.timezone || "Asia/Kolkata"} /><Field label="Date format" name="dateFormat" defaultValue={s.date_format || "dd MMM yyyy"} /><Field label="Default rent due day" name="defaultRentDueDay" type="number" min="1" max="28" defaultValue={s.default_rent_due_day || 10} /><Field label="Bill prefix" name="billPrefix" defaultValue={s.bill_prefix || "RF-BILL"} /><Field label="Receipt prefix" name="receiptPrefix" defaultValue={s.receipt_prefix || "RF-RCPT"} /><Field label="UPI ID" name="upiId" defaultValue={s.upi_id} /><MoneyField label="Default electricity ₹/unit" name="defaultElectricityRate" defaultValue={fromPaise(s.default_electricity_rate_paise)} /><MoneyField label="Default electricity fixed" name="defaultElectricityFixedCharge" defaultValue={fromPaise(s.default_electricity_fixed_charge_paise)} /><Field label="Max file size (MB)" name="maxFileSizeMb" type="number" min="1" max="100" defaultValue={s.max_file_size_mb || 20} /></Grid><TextField label="Bank / payment instructions" name="paymentInstructions" defaultValue={s.payment_instructions} /><TextField label="Bill footer / contact" name="billFooter" defaultValue={s.bill_footer} /></>; }
  if (kind === "erase") return <><div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><b>This permanently deletes:</b> properties, rooms, tenants, tenancies, rates, charges, readings, bills, payments, allocations, deposits, receipts, audit history, settings and private file copies.</div><Field label="Type DELETE ALL RENTFLOW DATA" name="confirmation" required autoComplete="off" /></>;
  return null;
}

function PaymentFields({ context, activeTenancies, model }: any) {
  const [tenancyId, setTenancyId] = useState(context.tenancyId || activeTenancies[0]?.id || "");
  const [mode, setMode] = useState("automatic");
  const openCharges = (model.openByTenancy[tenancyId] || []).sort((a: Row, b: Row) => a.dueDate.localeCompare(b.dueDate));
  return <><Grid><label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Tenancy</span><select name="tenancyId" required value={tenancyId} onChange={(e) => setTenancyId(e.target.value)} className={fieldClass}>{activeTenancies.map((t: Row) => <option value={t.id} key={t.id}>{tenancyLabel(t, model)}</option>)}</select></label><MoneyField label="Amount received" name="amount" required /><Field label="Payment date" name="paymentDate" type="date" required defaultValue={today()} /><SelectField label="Payment mode" name="mode" required options={[["cash", "Cash"], ["upi", "UPI"], ["bank_transfer", "Bank transfer"], ["cheque", "Cheque"], ["other", "Other"]]} /><Field label="Reference (optional)" name="reference" /><label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Allocation</span><select name="allocationMode" value={mode} onChange={(e) => setMode(e.target.value)} className={fieldClass}><option value="automatic">Automatic · oldest first</option><option value="manual">Manual allocation</option></select></label></Grid><TextField label="Notes" name="notes" />{mode === "manual" && <div className="rounded-xl border border-slate-200"><div className="border-b bg-slate-50 px-4 py-3 text-sm font-bold">Open charges</div>{openCharges.length ? <div className="divide-y">{openCharges.map((c: Row) => <div className="grid grid-cols-[1fr_auto] items-center gap-3 p-3" key={`${c.type}:${c.id}`}><div><div className="text-sm font-semibold">{titleCase(c.type)} · {formatDate(c.dueDate)}</div><div className="text-xs text-slate-500">Open {money(c.balance)}</div></div><input aria-label={`Allocate to ${c.type} ${c.dueDate}`} name={`allocation:${c.type}:${c.id}`} type="number" min="0" max={c.balance / 100} step="0.01" defaultValue="0" className={`${fieldClass} w-32 text-right`} /></div>)}</div> : <div className="p-4 text-sm text-slate-500">No open charges. The payment may be saved as unallocated credit.</div>}</div>}<ReviewNote>{mode === "automatic" ? "Automatic allocation applies the payment to the oldest open charges first. Any remainder stays as unallocated tenant credit." : "Manual allocations cannot exceed the payment amount or any charge balance. Unallocated funds remain as tenant credit."}</ReviewNote></>;
}

function ReadingFields({ context, data, month, activeTenancies, model }: any) {
  const initialTenancyId = context.tenancyId || activeTenancies[0]?.id || "";
  const [tenancyId, setTenancyId] = useState(initialTenancyId);
  const [billingMonth, setBillingMonth] = useState(() => nextAvailableReadingMonth(data.electricityReadings, initialTenancyId, month));
  const suggestion = useMemo(
    () => previousReadingSuggestion(data, tenancyId, billingMonth),
    [data, tenancyId, billingMonth],
  );
  const changeTenancy = (nextTenancyId: string) => {
    setTenancyId(nextTenancyId);
    setBillingMonth(nextAvailableReadingMonth(data.electricityReadings, nextTenancyId, month));
  };

  return <>
    <Grid>
      <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Tenancy</span><select name="tenancyId" required value={tenancyId} onChange={(e) => changeTenancy(e.target.value)} className={fieldClass}>{activeTenancies.map((t: Row) => <option value={t.id} key={t.id}>{tenancyLabel(t, model)}</option>)}</select></label>
      <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Billing month</span><input name="billingMonth" type="month" required value={billingMonth} onChange={(e) => setBillingMonth(e.target.value)} className={fieldClass} />{billingMonth !== month && <span className="mt-1.5 block text-xs leading-5 text-slate-500">{formatMonth(month)} already has a saved reading, so RentFlow started with the next open month.</span>}</label>
    </Grid>
    <ReadingValueFields key={`${tenancyId}:${billingMonth}`} suggestion={suggestion} />
  </>;
}

function ReadingValueFields({ suggestion }: { suggestion: Row }) {
  const [previousReading, setPreviousReading] = useState(suggestion.value == null ? "" : String(suggestion.value));
  const entered = Number(previousReading);
  const overridden = suggestion.value != null && previousReading !== "" && Number.isFinite(entered) && Math.abs(entered - Number(suggestion.value)) > 0.0005;

  return <>
    <Grid>
      <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Previous reading</span><input name="previousReading" type="number" step="0.001" min="0" required value={previousReading} onChange={(e) => setPreviousReading(e.target.value)} aria-describedby="previous-reading-source" className={fieldClass} /><span id="previous-reading-source" className="mt-1.5 block text-xs leading-5 text-slate-500">{suggestion.label}</span></label>
      <Field label="Current reading" name="currentReading" type="number" step="0.001" min="0" required />
      <Field label="Reading date" name="readingDate" type="date" required defaultValue={today()} />
      <Field label="Due date" name="dueDate" type="date" defaultValue={today()} />
    </Grid>
    {overridden && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900"><div className="flex items-start gap-2 text-sm leading-6"><CircleAlert className="mt-0.5 size-4 shrink-0" /><span>You changed the remembered reading from <b>{suggestion.value}</b> to <b>{previousReading}</b>. Add a reason so this correction is recorded.</span></div><TextField label="Reason for changing the previous reading" name="previousReadingOverrideReason" required /></div>}
    <TextField label="Notes (optional)" name="notes" />
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" name="finalize" defaultChecked className="size-4 accent-[#6558d3]" /> Finalize the electricity bill now</label>
    <ReviewNote>The previous value is carried from saved history. The bill will freeze the current and previous readings, units, effective rate and fixed charge.</ReviewNote>
  </>;
}

function BillDialog({ context, data, model, close }: any) {
  const receipt = context.receipt;
  if (receipt) {
    const snap = JSON.parse(receipt.snapshot_json);
    return <Dialog open onOpenChange={(o) => !o && close()}><DialogContent className="sm:max-w-2xl"><DialogHeader data-no-print><DialogTitle>Receipt {receipt.receipt_number}</DialogTitle><DialogDescription>Immutable snapshot from the saved payment.</DialogDescription></DialogHeader><div className="print-sheet rounded-2xl border border-slate-200 bg-white p-6"><div className="flex justify-between border-b pb-5"><div><div className="text-xl font-black text-primary">RENTFLOW</div><div className="text-sm text-slate-500">Payment receipt</div></div><div className="text-right text-sm"><b>{receipt.receipt_number}</b><div>{formatDate(snap.paymentDate)}</div><Status value={receipt.status} /></div></div><Definition rows={[["Received from", snap.tenant], ["Property / room", `${snap.property} · Room ${snap.room}`], ["Amount", money(snap.amountPaise)], ["Mode", titleCase(snap.mode)], ["Reference", snap.reference || "—"], ["Allocated", money((snap.allocations || []).reduce((s: number, a: Row) => s + a.amount_paise, 0))]]} /></div><DialogFooter data-no-print><Button variant="outline" onClick={close}>Close</Button><Button onClick={() => window.print()}><Printer /> Print / PDF</Button></DialogFooter></DialogContent></Dialog>;
  }
  const r = context; const t = r.tenancy;
  const eb = data.electricityBills.find((b: Row) => b.tenancy_id === t?.id && b.billing_month === r.charge?.billing_month);
  const previous = model.openByTenancy[t?.id]?.filter((c: Row) => c.dueDate < `${r.charge?.billing_month}-01`).reduce((s: number, c: Row) => s + c.balance, 0) || 0;
  const otherCharges = data.otherCharges.filter((c: Row) => c.tenancy_id === t?.id && c.charge_date.startsWith(r.charge?.billing_month || "") && !c.reversed);
  const summary = combinedBillSummary({ rentCharge: r.charge, electricityBill: eb, otherCharges, previousOutstanding: previous, allocationsByCharge: model.allocationsByCharge });
  return <Dialog open onOpenChange={(o) => !o && close()}><DialogContent className="sm:max-w-2xl"><DialogHeader data-no-print><DialogTitle>Combined tenant bill</DialogTitle><DialogDescription>Displayed subtotals preserve the underlying charge records.</DialogDescription></DialogHeader><div className="print-sheet rounded-2xl border border-slate-200 bg-white p-6"><div className="flex justify-between border-b pb-5"><div><div className="text-xl font-black text-primary">RENTFLOW</div><div className="text-sm text-slate-500">{data.settings.landlord_name || "Rental statement"}</div></div><div className="text-right text-sm"><b>{formatMonth(r.charge?.billing_month)}</b><div>Due {formatDate(r.charge?.due_date)}</div></div></div><Definition rows={[["Tenant", r.tenant], ["Property", r.property], ["Room", r.room]]} /><div className="space-y-2 border-y py-4 text-sm"><BillLine label="Monthly rent" value={summary.rent} /><BillLine label="Electricity" value={summary.electricity} />{eb && <div className="pl-3 text-xs text-slate-500">{eb.units} units @ {money(eb.rate_paise_per_unit)}/unit + {money(eb.fixed_charge_paise)} fixed{Number(eb.adjustment_paise) !== 0 && <> · historical adjustment {money(eb.adjustment_paise)}</>}</div>}<BillLine label="Previous outstanding" value={previous} /><BillLine label="Other charges / credits" value={summary.other} /></div><div className="space-y-2 pt-4"><BillLine label="Total payable" value={summary.total} strong /><BillLine label="Paid" value={summary.paid} /><BillLine label="Balance" value={summary.balance} strong /></div>{data.settings.upi_id && <div className="mt-5 rounded-xl bg-violet-50 p-3 text-sm"><b>Pay by UPI:</b> {data.settings.upi_id}<br />{data.settings.payment_instructions}</div>}</div><DialogFooter data-no-print><Button variant="outline" onClick={close}>Close</Button><Button onClick={() => window.print()}><Printer /> Print / PDF</Button></DialogFooter></DialogContent></Dialog>;
}

function LedgerDialog({ context, data, model, close }: any) {
  const tenant = context.searchOnly ? null : context; const tenancies = tenant ? data.tenancies.filter((t: Row) => t.tenant_id === tenant.id) : []; const ids = new Set(tenancies.map((t: Row) => t.id)); const lines: Row[] = [];
  data.rentCharges.filter((c: Row) => ids.has(c.tenancy_id) && !c.reversed).forEach((c: Row) => lines.push({ date: c.due_date, description: `${formatMonth(c.billing_month)} rent`, debit: c.amount_paise, credit: 0 }));
  data.electricityBills.filter((c: Row) => ids.has(c.tenancy_id) && !c.reversed).forEach((c: Row) => lines.push({ date: c.due_date || `${c.billing_month}-28`, description: `${formatMonth(c.billing_month)} electricity`, debit: c.total_paise, credit: 0 }));
  data.otherCharges.filter((c: Row) => ids.has(c.tenancy_id) && !c.reversed).forEach((c: Row) => lines.push({ date: c.charge_date, description: titleCase(c.charge_type), debit: Math.max(0, c.amount_paise), credit: Math.max(0, -c.amount_paise) }));
  data.payments.filter((p: Row) => ids.has(p.tenancy_id) && p.status === "recorded").forEach((p: Row) => lines.push({ date: p.payment_date, description: `${titleCase(p.mode)} payment`, debit: 0, credit: model.allocatedByPayment[p.id] || 0 }));
  lines.sort((a, b) => a.date.localeCompare(b.date)); let running = 0; const tableRows = lines.map((l) => { running += l.debit - l.credit; return [formatDate(l.date), l.description, l.debit ? money(l.debit) : "", l.credit ? money(l.credit) : "", money(running)]; });
  return <Dialog open onOpenChange={(o) => !o && close()}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{tenant ? `${tenant.full_name} · Ledger` : "Search RentFlow"}</DialogTitle><DialogDescription>{tenant ? "Chronological debits, allocated credits and running balance across tenancies." : "Use the global search field in the top bar to find tenants, rooms, properties, payments and receipts."}</DialogDescription></DialogHeader>{tenant && <ResponsiveTable heads={["Date", "Description", "Debit", "Credit", "Balance"]} rows={tableRows} empty="No ledger entries for this tenant." />}<DialogFooter><Button variant="outline" onClick={close}>Close</Button>{tenant && <Button onClick={() => downloadCsv(`${tenant.full_name}-ledger.csv`, lines)}><Download /> CSV statement</Button>}</DialogFooter></DialogContent></Dialog>;
}

function derive(data: DataState, month: string, propertyFilter: string) {
  const propertyById = Object.fromEntries(data.properties.map((r) => [r.id, r]));
  const roomById = Object.fromEntries(data.rooms.map((r) => [r.id, r]));
  const tenantById = Object.fromEntries(data.tenants.map((r) => [r.id, r]));
  const tenancyById = Object.fromEntries(data.tenancies.map((r) => [r.id, r]));
  const allocationsByCharge: Row = {}; const allocatedByPayment: Row = {};
  data.allocations.filter((a) => !a.reversed).forEach((a) => { allocationsByCharge[`${a.charge_type}:${a.charge_id}`] = (allocationsByCharge[`${a.charge_type}:${a.charge_id}`] || 0) + a.amount_paise; allocatedByPayment[a.payment_id] = (allocatedByPayment[a.payment_id] || 0) + a.amount_paise; });
  const monthStart = `${month}-01`; const monthEnd = endOfMonth(month);
  const activeTenancies = data.tenancies.filter((t) => t.rent_start_date <= monthEnd && (!t.move_out_date || t.move_out_date >= monthStart) && (!propertyFilter || t.property_id === propertyFilter));
  const activeByRoom = Object.fromEntries(data.tenancies.filter((t) => ["active", "notice"].includes(t.status)).map((t) => [t.room_id, t]));
  const rentRows = activeTenancies.map((t) => { const charge = data.rentCharges.find((c) => c.tenancy_id === t.id && c.billing_month === month && !c.reversed); const paid = charge ? allocationsByCharge[`rent:${charge.id}`] || 0 : 0; const balance = charge ? Math.max(0, charge.amount_paise - paid) : 0; const due = charge?.due_date; const status = !charge ? "missing" : balance === 0 ? "paid" : paid > 0 ? "partial" : due < today() ? "overdue" : "unpaid"; return { tenancy: t, charge, paid, balance, status, tenant: tenantById[t.tenant_id]?.full_name || "Unknown", room: roomById[t.room_id]?.room_number || "—", property: propertyById[t.property_id]?.name || "—" }; });
  const electricRows = activeTenancies.map((t) => { const reading = data.electricityReadings.find((r) => r.tenancy_id === t.id && r.billing_month === month); const bill = data.electricityBills.find((b) => b.tenancy_id === t.id && b.billing_month === month && !b.reversed); return { tenancy: t, reading, bill, tenant: tenantById[t.tenant_id]?.full_name || "Unknown", room: roomById[t.room_id]?.room_number || "—", meter: roomById[t.room_id]?.meter_number || "" }; });
  const charges: Row[] = [];
  data.rentCharges.filter((c) => !c.reversed).forEach((c) => charges.push({ type: "rent", id: c.id, tenancyId: c.tenancy_id, amount: c.amount_paise, balance: Math.max(0, c.amount_paise - (allocationsByCharge[`rent:${c.id}`] || 0)), dueDate: c.due_date, month: c.billing_month }));
  data.electricityBills.filter((c) => !c.reversed).forEach((c) => charges.push({ type: "electricity", id: c.id, tenancyId: c.tenancy_id, amount: c.total_paise, balance: Math.max(0, c.total_paise - (allocationsByCharge[`electricity:${c.id}`] || 0)), dueDate: c.due_date || `${c.billing_month}-28`, month: c.billing_month }));
  data.otherCharges.filter((c) => !c.reversed && c.amount_paise > 0).forEach((c) => charges.push({ type: "other", id: c.id, tenancyId: c.tenancy_id, amount: c.amount_paise, balance: Math.max(0, c.amount_paise - (allocationsByCharge[`other:${c.id}`] || 0)), dueDate: c.charge_date, month: c.charge_date.slice(0, 7) }));
  const openByTenancy: Row = {}; charges.filter((c) => c.balance > 0).forEach((c) => (openByTenancy[c.tenancyId] ||= []).push(c)); const balanceByTenancy: Row = {}; Object.entries(openByTenancy).forEach(([k, v]: any) => balanceByTenancy[k] = v.reduce((s: number, c: Row) => s + c.balance, 0));
  const pendingRows = activeTenancies.map((t) => { const open = openByTenancy[t.id] || []; const rent = open.filter((c: Row) => c.type === "rent" && c.month === month).reduce((s: number, c: Row) => s + c.balance, 0); const electricity = open.filter((c: Row) => c.type === "electricity" && c.month === month).reduce((s: number, c: Row) => s + c.balance, 0); const previous = open.filter((c: Row) => c.dueDate < monthStart).reduce((s: number, c: Row) => s + c.balance, 0); const other = open.filter((c: Row) => c.type === "other" && c.month === month).reduce((s: number, c: Row) => s + c.balance, 0); return { tenancyId: t.id, tenant: tenantById[t.tenant_id]?.full_name, room: roomById[t.room_id]?.room_number, rent, electricity, previous, other, total: rent + electricity + previous + other, overdue: open.some((c: Row) => c.dueDate < today()) }; }).filter((r) => r.total > 0);
  const expectedRent = rentRows.reduce((s, r) => s + (r.charge?.amount_paise || 0), 0); const rentCollected = rentRows.reduce((s, r) => s + r.paid, 0); const electricityBilled = electricRows.reduce((s, r) => s + (r.bill?.total_paise || 0), 0); const electricityCollected = electricRows.reduce((s, r) => s + (r.bill ? allocationsByCharge[`electricity:${r.bill.id}`] || 0 : 0), 0);
  const activeRooms = data.rooms.filter((r) => r.active && (!propertyFilter || r.property_id === propertyFilter)).length; const occupied = data.rooms.filter((r) => r.active && r.status === "occupied" && (!propertyFilter || r.property_id === propertyFilter)).length;
  const propertySummaries: Row = {}; data.properties.forEach((p) => { const rr = rentRows.filter((r) => r.tenancy.property_id === p.id); propertySummaries[p.id] = { expected: rr.reduce((s, r) => s + (r.charge?.amount_paise || 0), 0), collected: rr.reduce((s, r) => s + r.paid, 0), outstanding: pendingRows.filter((r) => tenancyById[r.tenancyId]?.property_id === p.id).reduce((s, r) => s + r.total, 0) }; });
  const depositHeld = data.deposits.reduce((s, d) => s + (["received", "adjustment"].includes(d.type) ? d.amount_paise : -d.amount_paise), 0);
  return { propertyById, roomById, tenantById, tenancyById, activeByRoom, activeTenancies, rentRows, electricRows, openByTenancy, balanceByTenancy, pendingRows, expectedRent, rentCollected, rentPending: Math.max(0, expectedRent - rentCollected), electricityBilled, electricityCollected, electricityPending: Math.max(0, electricityBilled - electricityCollected), totalPending: charges.reduce((s, c) => s + c.balance, 0), activeRooms, occupied, allocationsByCharge, allocatedByPayment, propertySummaries, depositHeld, propertyFilter };
}

function MobileNav({ page, setPage }: any) {
  const { toggleSidebar } = useSidebar(); const items: any[] = [["dashboard", "Home", LayoutDashboard], ["properties", "Properties", Building2], ["tenants", "Tenants", UsersRound], ["payments", "Payments", WalletCards]];
  return <nav data-no-print className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur md:hidden">{items.map(([key, label, Icon]) => <button key={key} onClick={() => setPage(key)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold ${page === key ? "text-primary" : "text-slate-500"}`}><Icon className="size-5" />{label}</button>)}<button onClick={toggleSidebar} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-slate-500"><Menu className="size-5" />More</button></nav>;
}

function SearchPopover({ results, onOpen }: any) {
  return <div className="absolute right-0 top-12 z-50 w-[380px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"><div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Search results</div>{results.length ? results.map((r: Row, i: number) => <button className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50" key={`${r.type}-${i}`} onClick={() => onOpen(r)}><div><div className="text-sm font-semibold">{r.title}</div><div className="text-xs text-slate-500">{r.subtitle}</div></div><span className="text-xs capitalize text-primary">{r.type}</span></button>) : <div className="px-3 py-5 text-sm text-slate-500">No matching saved records.</div>}</div>;
}

function globalSearch(data: DataState, q: string) {
  const s = q.trim().toLowerCase(); if (!s) return []; const out: Row[] = [];
  data.tenants.filter((t) => `${t.full_name} ${t.phone}`.toLowerCase().includes(s)).slice(0, 4).forEach((t) => out.push({ type: "tenant", title: t.full_name, subtitle: t.phone || "Tenant", row: t, page: "tenants" }));
  data.rooms.filter((r) => r.room_number.toLowerCase().includes(s)).slice(0, 3).forEach((r) => out.push({ type: "room", title: `Room ${r.room_number}`, subtitle: data.properties.find((p) => p.id === r.property_id)?.name, page: "rooms" }));
  data.properties.filter((p) => p.name.toLowerCase().includes(s)).slice(0, 3).forEach((p) => out.push({ type: "property", title: p.name, subtitle: p.address, page: "properties" }));
  data.receipts.filter((r) => r.receipt_number.toLowerCase().includes(s)).slice(0, 3).forEach((r) => out.push({ type: "receipt", title: r.receipt_number, subtitle: "Payment receipt", page: "payments" }));
  data.payments.filter((p) => String(p.reference).toLowerCase().includes(s)).slice(0, 3).forEach((p) => out.push({ type: "payment", title: p.reference, subtitle: money(p.amount_paise), page: "payments" })); return out.slice(0, 8);
}

function EmptyStart({ open }: any) { return <div className="grid min-h-[62vh] place-items-center"><div className="max-w-lg text-center"><div className="mx-auto grid size-20 place-items-center rounded-[28px] bg-gradient-to-br from-violet-100 to-indigo-100 text-primary"><Building2 className="size-9" /></div><h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">Your ledger starts clean</h2><p className="mx-auto mt-3 max-w-md text-base leading-7 text-slate-600">Add a property to begin. RentFlow will keep rooms, people, occupancy history and monthly money records separate and auditable.</p><Button size="lg" className="mt-6 h-12 rounded-xl px-6" onClick={() => open("property")}><Plus /> Add your first property</Button><div className="mt-8 grid grid-cols-3 gap-3 text-left"><EmptyPromise icon={ShieldCheck} label="Private" text="Owner-only access" /><EmptyPromise icon={RefreshCw} label="Durable" text="Server-backed data" /><EmptyPromise icon={ReceiptText} label="Auditable" text="Ledger allocations" /></div></div></div>; }
function LoadingView() { return <div className="space-y-5"><Skeleton className="h-16 rounded-2xl" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div><div className="grid gap-5 xl:grid-cols-2"><Skeleton className="h-80 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div></div>; }
function ErrorView({ error, retry }: any) { return <EmptyPanel icon={CircleAlert} title="RentFlow could not load" text={error} action={<Button onClick={retry}><RefreshCw /> Try again</Button>} />; }
function PageHead({ title, subtitle, action }: any) { return <div className="flex flex-wrap items-start gap-3"><div><h2 className="text-2xl font-black tracking-tight text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><div className="ml-auto flex gap-2">{action}</div></div>; }
function Card({ className = "", children }: any) { return <div className={`rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40 ${className}`}>{children}</div>; }
function SectionHead({ title, subtitle, action }: any) { return <div className="flex items-center gap-3 p-5"><div><h3 className="font-bold text-slate-900">{title}</h3>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>{action && <div className="ml-auto">{action}</div>}</div>; }
function MetricCard({ label, value, icon: Icon, tone }: any) { const tones: Row = { violet: "bg-violet-50 text-primary", green: "bg-emerald-50 text-emerald-700", orange: "bg-orange-50 text-orange-700", blue: "bg-blue-50 text-blue-700", red: "bg-red-50 text-red-700", navy: "bg-slate-900 text-white" }; return <Card><div className="p-4"><div className={`grid size-9 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-4" /></div><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate text-xl font-black text-slate-900">{value}</p></div></Card>; }
function MiniMetric({ label, value, positive, warning }: any) { return <Card><div className="p-4"><p className="text-sm text-slate-500">{label}</p><p className={`mt-1 text-2xl font-black ${positive ? "text-emerald-700" : warning ? "text-orange-700" : "text-slate-900"}`}>{value}</p></div></Card>; }
function CollectionBar({ label, collected, total, color }: any) { const pct = total > 0 ? Math.min(100, Math.round(collected / total * 100)) : 0; return <div><div className="mb-2 flex justify-between text-sm"><span className="font-semibold">{label}</span><span className="text-slate-500">{money(collected)} of {money(total)}{total > 0 ? ` · ${pct}%` : ""}</span></div><Progress value={pct} className={`h-2.5 ${color === "blue" ? "[&>div]:bg-blue-500" : "[&>div]:bg-[#6558d3]"}`} /></div>; }
function DarkStat({ label, value }: any) { return <div className="rounded-xl bg-white/[.07] p-3"><div className="text-2xl font-black">{value}</div><div className="mt-1 text-xs text-slate-300">{label}</div></div>; }
function TinyStat({ label, value }: any) { return <div><div className="font-bold text-slate-900">{value}</div><div className="text-[11px] text-slate-500">{label}</div></div>; }
function ResponsiveTable({ heads, rows, empty }: { heads: string[]; rows: any[][]; empty: string }) { if (!rows.length) return <MiniEmpty icon={FileText} text={empty} />; return <div className="w-full overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50/80">{heads.map((h) => <TableHead key={h} className="whitespace-nowrap px-4 text-xs font-bold uppercase tracking-wide text-slate-500">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row, i) => <TableRow key={i} className="hover:bg-slate-50/60">{row.map((cell, j) => <TableCell key={j} className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{cell ?? "—"}</TableCell>)}</TableRow>)}</TableBody></Table></div>; }
function MiniEmpty({ icon: Icon, text }: any) { return <div className="grid min-h-36 place-items-center px-5 pb-5 text-center"><div><Icon className="mx-auto size-6 text-slate-300" /><p className="mt-2 text-sm text-slate-500">{text}</p></div></div>; }
function EmptyPanel({ icon: Icon, title, text, action }: any) { return <Card><div className="grid min-h-80 place-items-center p-8 text-center"><div><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-violet-50 text-primary"><Icon /></div><h3 className="mt-4 text-xl font-bold text-slate-900">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{text}</p><div className="mt-5">{action}</div></div></div></Card>; }
function EmptyPromise({ icon: Icon, label, text }: any) { return <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><Icon className="size-4 text-primary" /><div className="mt-2 text-sm font-bold">{label}</div><div className="mt-0.5 text-[11px] text-slate-500">{text}</div></div>; }
function Status({ value }: { value: string }) { const v = value || "unknown"; const styles: Row = { paid: "bg-emerald-50 text-emerald-700", recorded: "bg-emerald-50 text-emerald-700", active: "bg-emerald-50 text-emerald-700", occupied: "bg-emerald-50 text-emerald-700", finalized: "bg-emerald-50 text-emerald-700", issued: "bg-emerald-50 text-emerald-700", partial: "bg-orange-50 text-orange-700", notice: "bg-orange-50 text-orange-700", unpaid: "bg-orange-50 text-orange-700", draft: "bg-blue-50 text-blue-700", vacant: "bg-blue-50 text-blue-700", missing: "bg-slate-100 text-slate-600", inactive: "bg-slate-100 text-slate-600", archived: "bg-slate-100 text-slate-600", overdue: "bg-red-50 text-red-700", reversed: "bg-red-50 text-red-700", void: "bg-red-50 text-red-700", maintenance: "bg-red-50 text-red-700", reserved: "bg-violet-50 text-violet-700" }; return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${styles[v] || styles.inactive}`}>{titleCase(v)}</span>; }
function Definition({ rows }: { rows: any[][] }) { return <dl className="divide-y divide-slate-100 px-5 pb-5">{rows.map(([k, v]) => <div className="flex justify-between gap-4 py-3 text-sm" key={k}><dt className="text-slate-500">{k}</dt><dd className="text-right font-semibold text-slate-800">{v || "—"}</dd></div>)}</dl>; }
function BillLine({ label, value, strong }: any) { return <div className={`flex justify-between ${strong ? "text-base font-black" : "text-sm"}`}><span>{label}</span><span>{money(value)}</span></div>; }
function Grid({ children }: any) { return <div className="grid gap-4 sm:grid-cols-2">{children}</div>; }
function Field({ label, name, defaultValue, ...props }: any) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span><input name={name} defaultValue={defaultValue ?? ""} className={fieldClass} {...props} /></label>; }
function MoneyField({ label, name, defaultValue, allowNegative, ...props }: any) { return <Field label={label} name={name} type="number" step="0.01" min={allowNegative ? undefined : "0"} defaultValue={defaultValue ?? "0"} {...props} />; }
function TextField({ label, name, defaultValue, required }: any) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span><textarea name={name} defaultValue={defaultValue ?? ""} required={required} className={textAreaClass} /></label>; }
function SelectField({ label, name, options, defaultValue, required }: any) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span><select name={name} defaultValue={defaultValue ?? options[0]?.[0]} required={required} className={fieldClass}>{options.map(([v, l]: any) => <option value={v} key={v}>{l}</option>)}</select></label>; }
function ReviewNote({ children }: any) { return <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-sm leading-6 text-violet-900"><b>Before saving:</b> {children}</div>; }
function ConfirmButton({ label, description, onConfirm, destructive, askReason }: any) { const [reason, setReason] = useState(""); return <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm" className={destructive ? "text-red-600 hover:text-red-700" : ""}>{label}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{label}?</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>{askReason && <Field label="Reason" name="reason" value={reason} onChange={(e: any) => setReason(e.target.value)} />}<AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant={destructive ? "destructive" : "default"} disabled={askReason && !reason.trim()} onClick={() => onConfirm(reason)}>{label}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>; }
function dialogSpec(kind: DialogKey, context: Row) { const map: Row = { property: [context.id ? "Edit property" : "Add property", "Property defaults are copied only into future records.", context.id ? "Save changes" : "Create property"], room: ["Add room", "Room numbers are unique within each property.", "Create room"], tenant: ["Add tenant", "Only the tenant name is required. Sensitive ID numbers are stored masked.", "Create tenant"], tenancy: ["Activate tenancy", "Link a person to an available room and create effective-dated rates.", "Activate tenancy"], payment: ["Record payment", "Review the automatic allocation after save in the Payments ledger.", "Record payment"], reading: [context.finalizeExisting ? "Finalize electricity bill" : "Add meter reading", context.finalizeExisting ? "The saved draft inputs will be frozen into a bill." : "The previous reading is carried forward automatically and can be corrected with a reason.", context.finalizeExisting ? "Finalize bill" : "Save reading"], other: ["Add charge or credit", "Adjust the ledger without mutating historical charges.", "Save entry"], deposit: ["Security deposit transaction", "Deposit money is reported separately from rental income.", "Save transaction"], rate: ["Schedule rent rate", "Historical monthly charges remain unchanged.", "Save new rate"], notice: ["Record notice", "Move-out remains a separate settlement step.", "Record notice"], moveout: ["Close tenancy", "The room becomes Vacant and all history remains available.", "Close tenancy"], upload: ["Upload private document", "Files open only through an authenticated RentFlow request.", "Upload"], settings: ["Edit settings", "These defaults apply to future workflows.", "Save settings"], erase: ["Erase all RentFlow data", "This is the strongest destructive action in RentFlow.", "Erase everything"] }; const [title, description, submit] = map[kind as string] || ["RentFlow", "", "Save"]; return { title, description, submit }; }

function money(paise: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: paise % 100 ? 2 : 0 }).format((Number(paise) || 0) / 100); }
function fromPaise(v: any) { return v == null ? "0" : String(Number(v) / 100); }
function toPaise(v: any) { const n = Number(v || 0); if (!Number.isFinite(n)) return NaN; return Math.round(n * 100); }
function today() { return new Date().toISOString().slice(0, 10); }
function localMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function firstNextMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10); }
function endOfMonth(m: string) { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); }
function formatMonth(m: string) { if (!m) return "—"; return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`)); }
function previousReadingSuggestion(data: DataState, tenancyId: string, billingMonth: string) {
  const prior = data.electricityReadings
    .filter((reading) => reading.tenancy_id === tenancyId && reading.billing_month < billingMonth)
    .sort((a, b) => String(b.billing_month).localeCompare(String(a.billing_month)) || String(b.reading_date).localeCompare(String(a.reading_date)))[0];
  if (prior) return { value: Number(prior.current_reading), label: `Carried forward from ${formatMonth(prior.billing_month)}.` };
  const tenancy = data.tenancies.find((item) => item.id === tenancyId);
  if (tenancy?.initial_meter_reading != null && Number.isFinite(Number(tenancy.initial_meter_reading))) return { value: Number(tenancy.initial_meter_reading), label: "Using the tenancy’s initial meter reading." };
  return { value: null, label: "No earlier reading was found. Enter the first previous reading." };
}
function formatDate(d: string) { if (!d) return "—"; return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d.length === 10 ? `${d}T00:00:00Z` : d)); }
function formatDateTime(d: string) { if (!d) return "—"; return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d)); }
function firstName(n: string) { return n.split(/[ @]/)[0] || "Owner"; }
function titleCase(s: string) { return String(s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function formatBytes(n: number) { if (n < 1024) return `${n} B`; if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`; return `${(n / 1048576).toFixed(1)} MB`; }
function tenancyLabel(t: Row, m: any) { return `${m.tenantById[t.tenant_id]?.full_name} · ${m.propertyById[t.property_id]?.name} / ${m.roomById[t.room_id]?.room_number}`; }
function pageHint(p: PageKey) { const hints: Row = { properties: "Buildings and billing defaults", rooms: "Units, meters and occupancy", tenants: "People, tenancies and statements", rent: "Idempotent monthly charges", electricity: "Meter readings and frozen bills", payments: "Receipts, allocations and reversals", reports: "Saved-data summaries and exports", documents: "Private evidence vault", settings: "Billing, payment and data controls" }; return hints[p] || ""; }
function downloadCsv(name: string, rows: Row[]) { if (!rows.length) { toast.info("There is no data to export yet."); return; } const keys = Object.keys(rows[0]); const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n"); download(name, new Blob([csv], { type: "text/csv;charset=utf-8" })); }
function downloadJson(name: string, value: unknown) { download(name, new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })); }
function download(name: string, blob: Blob) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
