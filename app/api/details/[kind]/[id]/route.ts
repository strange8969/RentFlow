import { database, jsonError, requireOwner, rows, one } from "../../../_lib";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;
const allowedTabs: Record<string, string[]> = {
  property: ["overview", "rooms", "tenancies", "financials", "documents", "activity"],
  room: ["overview", "tenancies", "billing", "electricity", "documents", "maintenance"],
  tenant: ["overview", "tenancies", "ledger", "bills", "payments", "deposits", "documents", "activity"],
};

export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const owner = await requireOwner();
    const { kind, id } = await params;
    if (!allowedTabs[kind]) return Response.json({ error: "Unknown detail type." }, { status: 404 });
    const url = new URL(request.url);
    const tab = allowedTabs[kind].includes(url.searchParams.get("tab") || "") ? url.searchParams.get("tab")! : allowedTabs[kind][0];
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = 25;
    const offset = (page - 1) * pageSize;
    const db = database();
    const q = (sql: string, ...values: any[]) => rows(db.prepare(sql).bind(...values));
    const get = (sql: string, ...values: any[]) => one(db.prepare(sql).bind(...values));

    const table = kind === "property" ? "properties" : kind === "room" ? "rooms" : "tenants";
    const entity = await get(`SELECT * FROM ${table} WHERE id = ? AND owner_key = ?`, id, owner.key) as Row | null;
    if (!entity) return Response.json({ error: `${kind[0].toUpperCase() + kind.slice(1)} not found in this workspace.` }, { status: 404 });

    let property: Row | null = kind === "property" ? entity : null;
    let room: Row | null = kind === "room" ? entity : null;
    let tenant: Row | null = kind === "tenant" ? entity : null;
    let tenancies: Row[] = [];

    if (kind === "property") {
      tenancies = await q("SELECT * FROM tenancies WHERE owner_key = ? AND property_id = ? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'notice' THEN 1 ELSE 2 END, move_in_date DESC", owner.key, id);
    } else if (kind === "room") {
      property = await get("SELECT p.* FROM properties p JOIN rooms r ON r.property_id = p.id WHERE r.id = ? AND r.owner_key = ? AND p.owner_key = ?", id, owner.key, owner.key) as Row | null;
      tenancies = await q("SELECT * FROM tenancies WHERE owner_key = ? AND room_id = ? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'notice' THEN 1 ELSE 2 END, move_in_date DESC", owner.key, id);
    } else {
      tenancies = await q("SELECT * FROM tenancies WHERE owner_key = ? AND tenant_id = ? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'notice' THEN 1 ELSE 2 END, move_in_date DESC", owner.key, id);
    }

    const requestedTenancyId = url.searchParams.get("tenancyId");
    if (requestedTenancyId && !tenancies.some((item) => item.id === requestedTenancyId)) return Response.json({ error: "That tenancy does not belong to this record." }, { status: 400 });
    const activeTenancy = tenancies.find((item) => item.status === "active" || item.status === "notice") || null;
    const selectedTenancyId = requestedTenancyId || activeTenancy?.id || tenancies[0]?.id || null;
    const selectedTenancy = tenancies.find((item) => item.id === selectedTenancyId) || null;
    if (kind === "tenant" && selectedTenancy) {
      room = await get("SELECT * FROM rooms WHERE id = ? AND owner_key = ?", selectedTenancy.room_id, owner.key) as Row | null;
      property = await get("SELECT * FROM properties WHERE id = ? AND owner_key = ?", selectedTenancy.property_id, owner.key) as Row | null;
    }

    const tenancyIds = tenancies.map((item) => item.id);
    const placeholders = tenancyIds.map(() => "?").join(",");
    const relatedTenants = tenancies.length ? await q(`SELECT * FROM tenants WHERE owner_key = ? AND id IN (SELECT tenant_id FROM tenancies WHERE owner_key = ? AND id IN (${placeholders}))`, owner.key, owner.key, ...tenancyIds) : [];
    const roomIds = [...new Set(tenancies.map((item) => item.room_id).filter(Boolean))];
    const roomMarks = roomIds.map(() => "?").join(",");
    const relatedRooms = kind === "property"
      ? await q("SELECT * FROM rooms WHERE owner_key = ? AND property_id = ? ORDER BY active DESC, room_number COLLATE NOCASE", owner.key, id)
      : roomIds.length ? await q(`SELECT * FROM rooms WHERE owner_key = ? AND id IN (${roomMarks}) ORDER BY room_number COLLATE NOCASE`, owner.key, ...roomIds) : [];
    const propertyIds = [...new Set(tenancies.map((item) => item.property_id).filter(Boolean))];
    const propertyMarks = propertyIds.map(() => "?").join(",");
    const relatedProperties = propertyIds.length ? await q(`SELECT * FROM properties WHERE owner_key = ? AND id IN (${propertyMarks})`, owner.key, ...propertyIds) : property ? [property] : [];
    const tenantById = Object.fromEntries(relatedTenants.map((item) => [item.id, item]));
    const roomById = Object.fromEntries(relatedRooms.map((item) => [item.id, item]));
    const propertyById = Object.fromEntries(relatedProperties.map((item) => [item.id, item]));

    const response: Row = { kind, tab, page, pageSize, entity, property, room, tenant, tenancies, activeTenancy, selectedTenancyId, relatedTenants, relatedRooms };

    if (kind === "property" && (tab === "overview" || tab === "rooms")) {
      const active = tenancies.filter((item) => item.status === "active" || item.status === "notice");
      response.rooms = relatedRooms.map((item) => {
        const stay = active.find((tenancy) => tenancy.room_id === item.id);
        return { ...item, tenancy: stay || null, tenant: stay ? tenantById[stay.tenant_id] || null : null };
      });
    }

    const financeTab = ["overview", "financials", "ledger", "bills", "payments", "deposits", "billing"].includes(tab);
    if (financeTab && tenancyIds.length) {
      const tenancyFilter = (kind === "tenant" || kind === "room") && selectedTenancyId ? [selectedTenancyId] : tenancyIds;
      const marks = tenancyFilter.map(() => "?").join(",");
      const [rentCharges, electricityBills, otherCharges, payments, allocations, deposits] = await Promise.all([
        q(`SELECT * FROM rent_charges WHERE owner_key = ? AND reversed = 0 AND tenancy_id IN (${marks}) ORDER BY billing_month DESC LIMIT ? OFFSET ?`, owner.key, ...tenancyFilter, pageSize, offset),
        q(`SELECT * FROM electricity_bills WHERE owner_key = ? AND reversed = 0 AND tenancy_id IN (${marks}) ORDER BY billing_month DESC LIMIT ? OFFSET ?`, owner.key, ...tenancyFilter, pageSize, offset),
        q(`SELECT * FROM other_charges WHERE owner_key = ? AND reversed = 0 AND tenancy_id IN (${marks}) ORDER BY charge_date DESC LIMIT ? OFFSET ?`, owner.key, ...tenancyFilter, pageSize, offset),
        q(`SELECT * FROM payments WHERE owner_key = ? AND tenancy_id IN (${marks}) ORDER BY payment_date DESC, created_at DESC LIMIT ? OFFSET ?`, owner.key, ...tenancyFilter, pageSize, offset),
        q(`SELECT * FROM payment_allocations WHERE owner_key = ? AND reversed = 0 AND tenancy_id IN (${marks}) ORDER BY created_at DESC`, owner.key, ...tenancyFilter),
        q(`SELECT * FROM deposit_ledger WHERE owner_key = ? AND tenancy_id IN (${marks}) ORDER BY date DESC LIMIT ? OFFSET ?`, owner.key, ...tenancyFilter, pageSize, offset),
      ]);
      const allocated = new Map<string, number>();
      for (const item of allocations) {
        const key = `${item.charge_type}:${item.charge_id}`;
        allocated.set(key, (allocated.get(key) || 0) + Number(item.amount_paise || 0));
      }
      const charges = [
        ...rentCharges.map((item) => ({ ...item, chargeType: "rent", date: item.billing_month, total_paise: Number(item.amount_paise || 0) })),
        ...electricityBills.map((item) => ({ ...item, chargeType: "electricity", date: item.billing_month, total_paise: Number(item.total_paise || 0) })),
        ...otherCharges.map((item) => ({ ...item, chargeType: "other", date: item.charge_date, total_paise: Number(item.amount_paise || 0) })),
      ].map((item) => ({ ...item, paid_paise: allocated.get(`${item.chargeType}:${item.id}`) || 0 }))
       .map((item) => ({ ...item, balance_paise: Math.max(0, item.total_paise - item.paid_paise) }))
       .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      response.finance = {
        charges, payments, deposits,
        billed_paise: charges.reduce((sum, item) => sum + item.total_paise, 0),
        paid_to_charges_paise: charges.reduce((sum, item) => sum + item.paid_paise, 0),
        outstanding_paise: charges.reduce((sum, item) => sum + item.balance_paise, 0),
        cash_received_paise: payments.filter((item) => item.status === "recorded").reduce((sum, item) => sum + Number(item.amount_paise || 0), 0),
      };
    }

    if (tab === "electricity" && selectedTenancyId) {
      response.electricity = {
        readings: await q("SELECT * FROM electricity_readings WHERE owner_key = ? AND tenancy_id = ? ORDER BY billing_month DESC LIMIT ? OFFSET ?", owner.key, selectedTenancyId, pageSize, offset),
        bills: await q("SELECT * FROM electricity_bills WHERE owner_key = ? AND tenancy_id = ? AND reversed = 0 ORDER BY billing_month DESC LIMIT ? OFFSET ?", owner.key, selectedTenancyId, pageSize, offset),
        rates: await q("SELECT * FROM electricity_rate_history WHERE owner_key = ? AND tenancy_id = ? ORDER BY effective_from DESC", owner.key, selectedTenancyId),
      };
    }
    if ((tab === "overview" || tab === "tenancies") && selectedTenancyId) {
      response.rentRates = await q("SELECT * FROM rent_rate_history WHERE owner_key = ? AND tenancy_id = ? ORDER BY effective_from DESC", owner.key, selectedTenancyId);
      response.electricityRates = await q("SELECT * FROM electricity_rate_history WHERE owner_key = ? AND tenancy_id = ? ORDER BY effective_from DESC", owner.key, selectedTenancyId);
    }
    if (tab === "documents") {
      if (kind === "property") response.documents = await q("SELECT * FROM documents WHERE owner_key = ? AND property_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?", owner.key, id, pageSize, offset);
      if (kind === "room") response.documents = await q("SELECT * FROM documents WHERE owner_key = ? AND room_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?", owner.key, id, pageSize, offset);
      if (kind === "tenant") response.documents = await q("SELECT * FROM documents WHERE owner_key = ? AND (tenant_id = ? OR tenancy_id IN (SELECT id FROM tenancies WHERE owner_key = ? AND tenant_id = ?)) ORDER BY created_at DESC LIMIT ? OFFSET ?", owner.key, id, owner.key, id, pageSize, offset);
    }
    if (tab === "maintenance" || (kind === "property" && tab === "overview")) {
      const clause = kind === "property" ? "property_id = ?" : "room_id = ?";
      response.maintenance = await q(`SELECT * FROM maintenance_issues WHERE owner_key = ? AND ${clause} ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, reported_date DESC LIMIT ? OFFSET ?`, owner.key, id, pageSize, offset);
    }
    if (tab === "activity" || tab === "overview") {
      const ids = [id, ...tenancyIds, ...relatedRooms.map((item) => item.id)];
      const marks = ids.map(() => "?").join(",");
      response.activity = ids.length ? await q(`SELECT * FROM audit_log WHERE owner_key = ? AND entity_id IN (${marks}) ORDER BY created_at DESC LIMIT ? OFFSET ?`, owner.key, ...ids, pageSize, offset) : [];
    }
    response.lookups = { tenantById, roomById, propertyById };
    return Response.json(response);
  } catch (error) {
    return jsonError(error);
  }
}
