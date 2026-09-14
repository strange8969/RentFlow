import { ApiError, audit, database, id, int, isoDate, jsonError, month, now, num, one, requireOwner, rows, safeJson, str, bucket } from "../_lib";
import { calculateMonthlyRent } from "../../rent-calculations";

export const dynamic = "force-dynamic";

type Payload = Record<string, unknown>;
const PAYMENT_MODES = new Set(["cash", "upi", "bank_transfer", "cheque", "other"]);
const CHARGE_TYPES = new Set(["rent", "electricity", "other"]);

export async function POST(request: Request) {
  try {
    const owner = await requireOwner();
    const db = database();
    const body = safeJson(await request.json());
    const action = str(body.action, "Action", true);
    const p = safeJson(body.payload);
    let result: unknown;

    switch (action) {
      case "create_property": {
        const entityId = id("prop");
        const name = str(p.name, "Property name", true);
        const dueDay = int(p.defaultRentDueDay ?? 10, "Rent due day", 1, 28);
        const rate = money(p.defaultElectricityRatePaise ?? 0, "Electricity rate", true);
        const fixed = money(p.defaultElectricityFixedChargePaise ?? 0, "Fixed charge", true);
        const at = now();
        await db.batch([
          db.prepare("INSERT INTO properties (id, owner_key, name, address, notes, default_rent_due_day, default_electricity_rate_paise, default_electricity_fixed_charge_paise, default_late_fee_mode, default_late_fee_value, currency, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'none', 0, 'INR', 1, ?, ?)").bind(entityId, owner.key, name, str(p.address, "Address"), str(p.notes, "Notes"), dueDay, rate, fixed, at, at),
          audit(db, owner, "property.created", "property", entityId, `Created property ${name}`),
        ]);
        result = { id: entityId };
        break;
      }
      case "update_property": {
        const entityId = str(p.id, "Property", true);
        await owned(db, "properties", entityId, owner.key);
        const name = str(p.name, "Property name", true);
        await db.batch([
          db.prepare("UPDATE properties SET name=?, address=?, notes=?, default_rent_due_day=?, default_electricity_rate_paise=?, default_electricity_fixed_charge_paise=?, updated_at=? WHERE id=? AND owner_key=?").bind(name, str(p.address, "Address"), str(p.notes, "Notes"), int(p.defaultRentDueDay ?? 10, "Rent due day", 1, 28), money(p.defaultElectricityRatePaise ?? 0, "Electricity rate", true), money(p.defaultElectricityFixedChargePaise ?? 0, "Fixed charge", true), now(), entityId, owner.key),
          audit(db, owner, "property.updated", "property", entityId, `Updated property ${name}`),
        ]);
        result = { id: entityId };
        break;
      }
      case "archive_property": {
        const entityId = str(p.id, "Property", true);
        const property = await owned(db, "properties", entityId, owner.key);
        const activeTenancy = await one(db.prepare("SELECT t.id FROM tenancies t WHERE t.owner_key=? AND t.property_id=? AND t.status IN ('active','notice') LIMIT 1").bind(owner.key, entityId));
        if (activeTenancy) throw new ApiError(409, "Move out active tenancies before archiving this property.");
        await db.batch([db.prepare("UPDATE properties SET active=0, updated_at=? WHERE id=? AND owner_key=?").bind(now(), entityId, owner.key), audit(db, owner, "property.archived", "property", entityId, `Archived property ${String(property.name)}`)]);
        result = { id: entityId };
        break;
      }
      case "delete_property": {
        const entityId = str(p.id, "Property", true);
        await owned(db, "properties", entityId, owner.key);
        const linked = await one<{ n: number }>(db.prepare("SELECT (SELECT COUNT(*) FROM rooms WHERE owner_key=? AND property_id=?) + (SELECT COUNT(*) FROM tenancies WHERE owner_key=? AND property_id=?) n").bind(owner.key, entityId, owner.key, entityId));
        if ((linked?.n ?? 0) > 0) throw new ApiError(409, "This property has room or tenancy history and must be archived instead.");
        await db.batch([db.prepare("DELETE FROM properties WHERE id=? AND owner_key=?").bind(entityId, owner.key), audit(db, owner, "property.deleted", "property", entityId, "Deleted unused property")]);
        result = { id: entityId };
        break;
      }
      case "create_room": {
        const entityId = id("room");
        const propertyId = str(p.propertyId, "Property", true);
        await owned(db, "properties", propertyId, owner.key);
        const roomNumber = str(p.roomNumber, "Room number", true);
        const status = str(p.status, "Status") || "vacant";
        if (!new Set(["vacant", "reserved", "maintenance"]).has(status)) throw new ApiError(400, "New rooms may be Vacant, Reserved, or Maintenance.");
        const at = now();
        await db.batch([
          db.prepare("INSERT INTO rooms (id, owner_key, property_id, room_number, normalized_room_number, floor, meter_number, status, notes, asking_rent_paise, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)").bind(entityId, owner.key, propertyId, roomNumber, roomNumber.trim().toLowerCase(), str(p.floor, "Floor"), str(p.meterNumber, "Meter number"), status, str(p.notes, "Notes"), money(p.askingRentPaise ?? 0, "Asking rent", true), at, at),
          db.prepare("INSERT INTO room_availability_history (id, owner_key, room_id, status, effective_from, reason, created_at) VALUES (?, ?, ?, ?, ?, 'Room created', ?)").bind(id("avail"), owner.key, entityId, status, at.slice(0, 10), at),
          audit(db, owner, "room.created", "room", entityId, `Created room ${roomNumber}`),
        ]);
        result = { id: entityId };
        break;
      }
      case "update_room": {
        const entityId = str(p.id, "Room", true); const room = await owned(db, "rooms", entityId, owner.key);
        const propertyId = str(p.propertyId, "Property", true); await owned(db, "properties", propertyId, owner.key);
        const roomNumber = str(p.roomNumber, "Room number", true); const status = str(p.status, "Status", true);
        if (!new Set(["vacant", "reserved", "maintenance", "occupied"]).has(status)) throw new ApiError(400, "Room status is invalid.");
        const activeTenancy = await one(db.prepare("SELECT id FROM tenancies WHERE owner_key=? AND room_id=? AND status IN ('active','notice') LIMIT 1").bind(owner.key, entityId));
        if (activeTenancy && status !== "occupied") throw new ApiError(409, "An occupied room must remain Occupied until its tenancy is closed.");
        if (!activeTenancy && status === "occupied") throw new ApiError(409, "Use Move in to mark a room Occupied.");
        const at = now(); const statements = [db.prepare("UPDATE rooms SET property_id=?, room_number=?, normalized_room_number=?, floor=?, meter_number=?, status=?, notes=?, asking_rent_paise=?, updated_at=? WHERE id=? AND owner_key=?").bind(propertyId, roomNumber, roomNumber.toLowerCase(), str(p.floor, "Floor"), str(p.meterNumber, "Meter number"), status, str(p.notes, "Notes"), money(p.askingRentPaise ?? 0, "Asking rent", true), at, entityId, owner.key), audit(db, owner, "room.updated", "room", entityId, `Updated room ${roomNumber}`)];
        if (String(room.status) !== status) statements.splice(1, 0, ...availabilityStatements(db, owner.key, entityId, status, at.slice(0, 10), "Room status updated", at));
        await db.batch(statements); result = { id: entityId }; break;
      }
      case "archive_room": {
        const entityId = str(p.id, "Room", true);
        const room = await owned(db, "rooms", entityId, owner.key);
        const activeTenancy = await one(db.prepare("SELECT id FROM tenancies WHERE owner_key=? AND room_id=? AND status IN ('active','notice') LIMIT 1").bind(owner.key, entityId));
        if (activeTenancy) throw new ApiError(409, "Move out the active tenancy before archiving this room.");
        const at = now(); await db.batch([db.prepare("UPDATE rooms SET active=0, status='maintenance', updated_at=? WHERE id=? AND owner_key=?").bind(at, entityId, owner.key), ...availabilityStatements(db, owner.key, entityId, "archived", at.slice(0, 10), "Room archived", at), audit(db, owner, "room.archived", "room", entityId, `Archived room ${String(room.room_number)}`)]);
        result = { id: entityId };
        break;
      }
      case "delete_room": {
        const entityId = str(p.id, "Room", true);
        await owned(db, "rooms", entityId, owner.key);
        const linked = await one<{ n: number }>(db.prepare("SELECT COUNT(*) n FROM tenancies WHERE owner_key=? AND room_id=?").bind(owner.key, entityId));
        if ((linked?.n ?? 0) > 0) throw new ApiError(409, "This room has tenancy history and must be archived instead.");
        await db.batch([db.prepare("DELETE FROM rooms WHERE id=? AND owner_key=?").bind(entityId, owner.key), audit(db, owner, "room.deleted", "room", entityId, "Deleted unused room")]);
        result = { id: entityId };
        break;
      }
      case "create_tenant": {
        const entityId = id("tenant"); const at = now(); const fullName = str(p.fullName, "Full name", true);
        await db.batch([
          db.prepare("INSERT INTO tenants (id, owner_key, full_name, phone, alternate_phone, email, id_type, id_number_masked, permanent_address, emergency_contact_name, emergency_contact_phone, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)").bind(entityId, owner.key, fullName, str(p.phone, "Phone"), str(p.alternatePhone, "Alternate phone"), str(p.email, "Email"), str(p.idType, "ID type"), maskId(str(p.idNumber, "ID number")), str(p.permanentAddress, "Address"), str(p.emergencyContactName, "Emergency contact"), str(p.emergencyContactPhone, "Emergency phone"), str(p.notes, "Notes"), at, at),
          audit(db, owner, "tenant.created", "tenant", entityId, `Created tenant ${fullName}`),
        ]);
        result = { id: entityId };
        break;
      }
      case "update_tenant": {
        const entityId = str(p.id, "Tenant", true); await owned(db, "tenants", entityId, owner.key); const fullName = str(p.fullName, "Full name", true); const at = now();
        await db.batch([db.prepare("UPDATE tenants SET full_name=?, phone=?, alternate_phone=?, email=?, id_type=?, permanent_address=?, emergency_contact_name=?, emergency_contact_phone=?, notes=?, updated_at=? WHERE id=? AND owner_key=?").bind(fullName, str(p.phone, "Phone"), str(p.alternatePhone, "Alternate phone"), str(p.email, "Email"), str(p.idType, "ID type"), str(p.permanentAddress, "Address"), str(p.emergencyContactName, "Emergency contact"), str(p.emergencyContactPhone, "Emergency phone"), str(p.notes, "Notes"), at, entityId, owner.key), audit(db, owner, "tenant.updated", "tenant", entityId, `Updated tenant ${fullName}`)]);
        result = { id: entityId }; break;
      }
      case "activate_tenancy": {
        const entityId = id("ten"); const propertyId = str(p.propertyId, "Property", true); const roomId = str(p.roomId, "Room", true); const tenantId = str(p.tenantId, "Tenant", true);
        await Promise.all([owned(db, "properties", propertyId, owner.key), owned(db, "rooms", roomId, owner.key), owned(db, "tenants", tenantId, owner.key)]);
        const room = await one<Record<string, unknown>>(db.prepare("SELECT * FROM rooms WHERE id=? AND owner_key=? AND property_id=? AND active=1").bind(roomId, owner.key, propertyId));
        if (!room) throw new ApiError(400, "The selected room does not belong to this active property.");
        const overlap = await one(db.prepare("SELECT id FROM tenancies WHERE owner_key=? AND room_id=? AND status IN ('active','notice') LIMIT 1").bind(owner.key, roomId));
        if (overlap) throw new ApiError(409, "This room already has an active tenancy.");
        const moveIn = isoDate(p.moveInDate, "Move-in date"); const rentStart = isoDate(p.rentStartDate, "Rent start date");
        const rent = money(p.monthlyRentPaise, "Monthly rent"); const dueDay = int(p.rentDueDay, "Rent due day", 1, 28);
        const electricityRate = money(p.electricityRatePaise ?? 0, "Electricity rate", true); const fixed = money(p.electricityFixedChargePaise ?? 0, "Fixed charge", true);
        const depositRequired = money(p.securityDepositRequiredPaise ?? 0, "Required deposit", true); const depositReceived = money(p.securityDepositReceivedPaise ?? 0, "Deposit received", true); const openingBalance = money(p.openingBalancePaise ?? 0, "Opening balance", true);
        const initialMeter = p.initialMeterReading === "" || p.initialMeterReading == null ? null : num(p.initialMeterReading, "Initial meter reading", 0);
        const at = now(); const statements: D1PreparedStatement[] = [
          db.prepare("INSERT INTO tenancies (id, owner_key, property_id, room_id, tenant_id, move_in_date, rent_start_date, rent_due_day, security_deposit_required_paise, opening_balance_paise, initial_meter_reading, rent_proration_mode, agreement_end_date, planned_move_out_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)").bind(entityId, owner.key, propertyId, roomId, tenantId, moveIn, rentStart, dueDay, depositRequired, openingBalance, initialMeter, enumValue(p.rentProrationMode, "Rent calculation", ["full_month", "prorated"], "full_month"), optionalDate(p.agreementEndDate, "Agreement end date"), optionalDate(p.plannedMoveOutDate, "Planned move-out date"), at, at),
          db.prepare("INSERT INTO rent_rate_history (id, owner_key, tenancy_id, amount_paise, effective_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id("rr"), owner.key, entityId, rent, rentStart, at, at),
          db.prepare("INSERT INTO electricity_rate_history (id, owner_key, tenancy_id, rate_paise_per_unit, fixed_charge_paise, effective_from, tariff_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)").bind(id("er"), owner.key, entityId, electricityRate, fixed, rentStart, at, at),
          db.prepare("UPDATE rooms SET status='occupied', updated_at=? WHERE id=? AND owner_key=?").bind(at, roomId, owner.key),
          ...availabilityStatements(db, owner.key, roomId, "occupied", moveIn, "Tenancy activated", at),
          audit(db, owner, "tenancy.activated", "tenancy", entityId, `Activated tenancy in room ${String(room.room_number)}`),
        ];
        if (depositReceived > 0) statements.push(db.prepare("INSERT INTO deposit_ledger (id, owner_key, tenancy_id, type, amount_paise, date, description, created_at, updated_at) VALUES (?, ?, ?, 'received', ?, ?, 'Deposit received at move-in', ?, ?)").bind(id("dep"), owner.key, entityId, depositReceived, moveIn, at, at));
        if (openingBalance > 0) statements.push(db.prepare("INSERT INTO other_charges (id, owner_key, tenancy_id, charge_date, charge_type, amount_paise, description, reversed, created_at, updated_at) VALUES (?, ?, ?, ?, 'opening_balance', ?, 'Opening balance at move-in', 0, ?, ?)").bind(id("other"), owner.key, entityId, moveIn, openingBalance, at, at));
        await db.batch(statements); result = { id: entityId }; break;
      }
      case "set_notice": {
        const entityId = str(p.tenancyId, "Tenancy", true); await owned(db, "tenancies", entityId, owner.key);
        const noticeDate = isoDate(p.noticeDate, "Notice date"); const planned = optionalDate(p.plannedMoveOutDate, "Planned move-out date");
        await db.batch([db.prepare("UPDATE tenancies SET status='notice', notice_date=?, planned_move_out_date=?, updated_at=? WHERE id=? AND owner_key=? AND status='active'").bind(noticeDate, planned, now(), entityId, owner.key), audit(db, owner, "tenancy.notice", "tenancy", entityId, `Notice recorded for ${noticeDate}`)]);
        result = { id: entityId }; break;
      }
      case "move_out": {
        const entityId = str(p.tenancyId, "Tenancy", true); const tenancy = await owned(db, "tenancies", entityId, owner.key);
        if (!new Set(["active", "notice"]).has(String(tenancy.status))) throw new ApiError(409, "This tenancy is already closed.");
        const moveOutDate = isoDate(p.moveOutDate, "Move-out date");
        await db.batch([
          db.prepare("UPDATE tenancies SET status='moved_out', move_out_date=?, updated_at=? WHERE id=? AND owner_key=?").bind(moveOutDate, now(), entityId, owner.key),
          db.prepare("UPDATE rooms SET status='vacant', updated_at=? WHERE id=? AND owner_key=?").bind(now(), tenancy.room_id, owner.key),
          ...availabilityStatements(db, owner.key, String(tenancy.room_id), "vacant", moveOutDate, "Tenancy closed", now()),
          audit(db, owner, "tenancy.closed", "tenancy", entityId, `Closed tenancy on ${moveOutDate}; history retained`),
        ]); result = { id: entityId }; break;
      }
      case "update_rent_rate": {
        const tenancyId = str(p.tenancyId, "Tenancy", true); await owned(db, "tenancies", tenancyId, owner.key);
        const effectiveFrom = isoDate(p.effectiveFrom, "Effective date"); const amount = money(p.amountPaise, "Monthly rent"); const rateId = id("rr"); const at = now();
        await db.batch([
          db.prepare("UPDATE rent_rate_history SET effective_to=date(?, '-1 day'), updated_at=? WHERE owner_key=? AND tenancy_id=? AND effective_from<? AND (effective_to IS NULL OR effective_to>=?)").bind(effectiveFrom, at, owner.key, tenancyId, effectiveFrom, effectiveFrom),
          db.prepare("INSERT INTO rent_rate_history (id, owner_key, tenancy_id, amount_paise, effective_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(rateId, owner.key, tenancyId, amount, effectiveFrom, at, at),
          audit(db, owner, "rent_rate.created", "tenancy", tenancyId, `New rent rate effective ${effectiveFrom}`),
        ]); result = { id: rateId }; break;
      }
      case "update_electricity_rate": {
        const tenancyId = str(p.tenancyId, "Tenancy", true); await owned(db, "tenancies", tenancyId, owner.key);
        const effectiveFrom = isoDate(p.effectiveFrom, "Effective date"); const rate = money(p.ratePaisePerUnit, "Electricity rate", true); const fixed = money(p.fixedChargePaise ?? 0, "Fixed charge", true); const rateId = id("er"); const at = now();
        await db.batch([
          db.prepare("UPDATE electricity_rate_history SET effective_to=date(?, '-1 day'), updated_at=? WHERE owner_key=? AND tenancy_id=? AND effective_from<? AND (effective_to IS NULL OR effective_to>=?)").bind(effectiveFrom, at, owner.key, tenancyId, effectiveFrom, effectiveFrom),
          db.prepare("INSERT INTO electricity_rate_history (id, owner_key, tenancy_id, rate_paise_per_unit, fixed_charge_paise, effective_from, tariff_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)").bind(rateId, owner.key, tenancyId, rate, fixed, effectiveFrom, at, at),
          audit(db, owner, "electricity_rate.created", "tenancy", tenancyId, `New electricity rate effective ${effectiveFrom}`),
        ]); result = { id: rateId }; break;
      }
      case "generate_rent": {
        const billingMonth = month(p.billingMonth); const propertyId = str(p.propertyId, "Property");
        const periodStart = `${billingMonth}-01`; const periodEnd = monthEnd(billingMonth); const params: unknown[] = [owner.key, periodEnd, periodStart];
        let query = "SELECT * FROM tenancies WHERE owner_key=? AND rent_start_date<=? AND (move_out_date IS NULL OR move_out_date>=?)";
        if (propertyId) { query += " AND property_id=?"; params.push(propertyId); }
        const active = await rows<Record<string, unknown>>(db.prepare(query).bind(...params));
        const inserts: D1PreparedStatement[] = []; let skipped = 0; const at = now();
        const tenancyIds = active.map((tenancy) => String(tenancy.id));
        const rateRows = tenancyIds.length ? await rows<{ tenancy_id: string; amount_paise: number; effective_from: string; effective_to: string | null }>(db.prepare(`SELECT tenancy_id, amount_paise, effective_from, effective_to FROM rent_rate_history WHERE owner_key=? AND tenancy_id IN (${tenancyIds.map(() => "?").join(",")}) ORDER BY effective_from`).bind(owner.key, ...tenancyIds)) : [];
        for (const tenancy of active) {
          const exists = await one(db.prepare("SELECT id FROM rent_charges WHERE tenancy_id=? AND billing_month=? AND source='generated'").bind(tenancy.id, billingMonth));
          if (exists) { skipped++; continue; }
          const calculation = calculateMonthlyRent(tenancy as any, rateRows, billingMonth); if (!calculation) { skipped++; continue; }
          const due = `${billingMonth}-${String(Math.min(Number(tenancy.rent_due_day), Number(periodEnd.slice(-2)))).padStart(2, "0")}`;
          inserts.push(db.prepare("INSERT OR IGNORE INTO rent_charges (id, owner_key, tenancy_id, billing_month, period_start, period_end, amount_paise, due_date, source, note, reversed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generated', ?, 0, ?, ?)").bind(id("rent"), owner.key, tenancy.id, billingMonth, calculation.periodStart, calculation.periodEnd, calculation.amountPaise, due, calculation.note, at, at));
        }
        if (inserts.length) await db.batch([...inserts, audit(db, owner, "rent.generated", "rent_charge", billingMonth, `Generated ${inserts.length} rent charge(s); ${skipped} skipped`)]);
        result = { inserted: inserts.length, skipped, errors: 0 }; break;
      }
      case "record_electricity": {
        const tenancyId = str(p.tenancyId, "Tenancy", true); const tenancy = await owned(db, "tenancies", tenancyId, owner.key); const billingMonth = month(p.billingMonth);
        const previous = num(p.previousReading, "Previous reading", 0); const current = num(p.currentReading, "Current reading", 0);
        if (current < previous) throw new ApiError(400, "Current reading cannot be lower than the previous reading. Use a meter reset workflow for replacements.");
        const existing = await one(db.prepare("SELECT id FROM electricity_readings WHERE tenancy_id=? AND billing_month=?").bind(tenancyId, billingMonth));
        if (existing) throw new ApiError(409, "A reading already exists for this tenancy and month.");
        const prior = await one<{ current_reading: number; billing_month: string }>(db.prepare("SELECT current_reading, billing_month FROM electricity_readings WHERE owner_key=? AND tenancy_id=? AND billing_month<? ORDER BY billing_month DESC, reading_date DESC, created_at DESC LIMIT 1").bind(owner.key, tenancyId, billingMonth));
        const rememberedPrevious = prior ? Number(prior.current_reading) : tenancy.initial_meter_reading == null ? null : Number(tenancy.initial_meter_reading);
        const previousSource = prior ? prior.billing_month : rememberedPrevious == null ? null : "tenancy start";
        const previousWasOverridden = rememberedPrevious != null && Math.abs(previous - rememberedPrevious) > 0.0005;
        const overrideReason = previousWasOverridden ? str(p.previousReadingOverrideReason, "Reason for changing the previous reading", true) : "";
        const rate = await one<{ rate_paise_per_unit: number; fixed_charge_paise: number }>(db.prepare("SELECT rate_paise_per_unit, fixed_charge_paise FROM electricity_rate_history WHERE owner_key=? AND tenancy_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1").bind(owner.key, tenancyId, monthEnd(billingMonth)));
        if (!rate) throw new ApiError(400, "Set an electricity rate for this tenancy first.");
        const units = Math.round((current - previous) * 1000) / 1000; const energy = Math.round(units * rate.rate_paise_per_unit); const adjustment = 0; const total = energy + rate.fixed_charge_paise;
        if (total < 0) throw new ApiError(400, "Electricity total cannot be negative.");
        const readingId = id("read"); const final = Boolean(p.finalize); const at = now();
        const note = str(p.notes, "Notes");
        const correctionNote = previousWasOverridden ? `Previous reading changed from ${rememberedPrevious} (${previousSource}) to ${previous}. Reason: ${overrideReason}` : "";
        const storedNotes = [note, correctionNote].filter(Boolean).join("\n");
        const auditSummary = previousWasOverridden ? `Recorded ${units} unit(s) for ${billingMonth}; ${correctionNote}` : `Recorded ${units} unit(s) for ${billingMonth}`;
        const stmts = [db.prepare("INSERT INTO electricity_readings (id, owner_key, tenancy_id, billing_month, previous_reading, current_reading, units, reading_date, meter_number_snapshot, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT meter_number FROM rooms WHERE id=?), ''), ?, ?, ?, ?)").bind(readingId, owner.key, tenancyId, billingMonth, previous, current, units, isoDate(p.readingDate, "Reading date"), tenancy.room_id, storedNotes, final ? "finalized" : "draft", at, at), audit(db, owner, "electricity.reading_recorded", "electricity_reading", readingId, auditSummary)];
        if (final) stmts.push(db.prepare("INSERT INTO electricity_bills (id, owner_key, tenancy_id, reading_id, billing_month, units, rate_paise_per_unit, energy_charge_paise, fixed_charge_paise, adjustment_paise, total_paise, due_date, bill_number, reversed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)").bind(id("ebill"), owner.key, tenancyId, readingId, billingMonth, units, rate.rate_paise_per_unit, energy, rate.fixed_charge_paise, adjustment, total, str(p.dueDate, "Due date") || null, null, at, at));
        await db.batch(stmts); result = { id: readingId, units, energyChargePaise: energy, fixedChargePaise: rate.fixed_charge_paise, adjustmentPaise: adjustment, totalPaise: total, previousReadingSource: previousSource, status: final ? "finalized" : "draft" }; break;
      }
      case "finalize_electricity": {
        const readingId = str(p.readingId, "Reading", true); const reading = await owned(db, "electricity_readings", readingId, owner.key);
        if (reading.status === "finalized") throw new ApiError(409, "This reading is already finalized.");
        const rate = await one<{ rate_paise_per_unit: number; fixed_charge_paise: number }>(db.prepare("SELECT rate_paise_per_unit, fixed_charge_paise FROM electricity_rate_history WHERE owner_key=? AND tenancy_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1").bind(owner.key, reading.tenancy_id, monthEnd(String(reading.billing_month))));
        if (!rate) throw new ApiError(400, "Set an electricity rate first.");
        const adjustment = 0; const energy = Math.round(Number(reading.units) * rate.rate_paise_per_unit); const total = energy + rate.fixed_charge_paise; const billId = id("ebill"); const at = now();
        await db.batch([db.prepare("INSERT INTO electricity_bills (id, owner_key, tenancy_id, reading_id, billing_month, units, rate_paise_per_unit, energy_charge_paise, fixed_charge_paise, adjustment_paise, total_paise, due_date, reversed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)").bind(billId, owner.key, reading.tenancy_id, readingId, reading.billing_month, reading.units, rate.rate_paise_per_unit, energy, rate.fixed_charge_paise, adjustment, total, str(p.dueDate, "Due date") || null, at, at), db.prepare("UPDATE electricity_readings SET status='finalized', updated_at=? WHERE id=? AND owner_key=?").bind(at, readingId, owner.key), audit(db, owner, "electricity.bill_finalized", "electricity_bill", billId, `Finalized electricity bill for ${String(reading.billing_month)}`)]);
        result = { id: billId, totalPaise: total }; break;
      }
      case "create_other_charge": {
        const tenancyId = str(p.tenancyId, "Tenancy", true); await owned(db, "tenancies", tenancyId, owner.key); const entityId = id("other"); const amount = money(p.amountPaise, "Amount", false, true);
        if (amount === 0) throw new ApiError(400, "Amount cannot be zero.");
        await db.batch([db.prepare("INSERT INTO other_charges (id, owner_key, tenancy_id, charge_date, charge_type, amount_paise, description, reversed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)").bind(entityId, owner.key, tenancyId, isoDate(p.chargeDate, "Charge date"), str(p.chargeType, "Charge type", true), amount, str(p.description, "Description", true), now(), now()), audit(db, owner, amount < 0 ? "credit.created" : "other_charge.created", "other_charge", entityId, str(p.description, "Description", true))]);
        result = { id: entityId }; break;
      }
      case "record_payment": {
        const tenancyId = str(p.tenancyId, "Tenancy", true); const tenancy = await owned(db, "tenancies", tenancyId, owner.key); const amount = money(p.amountPaise, "Payment amount"); const mode = str(p.mode, "Payment mode", true);
        if (!PAYMENT_MODES.has(mode)) throw new ApiError(400, "Payment mode is invalid.");
        const requestKey = str(p.requestKey, "Request key") || id("request"); const duplicate = await one<Record<string, unknown>>(db.prepare("SELECT * FROM payments WHERE owner_key=? AND request_key=?").bind(owner.key, requestKey)); if (duplicate) { result = duplicate; break; }
        const paymentId = id("pay"); const at = now(); let resolved: { chargeType: string; chargeId: string; amountPaise: number }[] = [];
        if (p.allocationMode === "manual") resolved = await validateManualAllocations(db, owner.key, tenancyId, amount, Array.isArray(p.allocations) ? p.allocations : []);
        else resolved = await automaticAllocations(db, owner.key, tenancyId, amount);
        const allocated = resolved.reduce((s, a) => s + a.amountPaise, 0);
        const stmts: D1PreparedStatement[] = [db.prepare("INSERT INTO payments (id, owner_key, tenancy_id, tenant_id, amount_paise, payment_date, mode, reference, notes, request_key, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?, ?)").bind(paymentId, owner.key, tenancyId, tenancy.tenant_id, amount, isoDate(p.paymentDate, "Payment date"), mode, str(p.reference, "Reference"), str(p.notes, "Notes"), requestKey, at, at)];
        for (const a of resolved) stmts.push(db.prepare("INSERT INTO payment_allocations (id, owner_key, payment_id, charge_type, charge_id, amount_paise, reversed, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)").bind(id("alloc"), owner.key, paymentId, a.chargeType, a.chargeId, a.amountPaise, at));
        stmts.push(audit(db, owner, "payment.recorded", "payment", paymentId, `Recorded payment; allocated ${allocated} paise`)); await db.batch(stmts);
        result = { id: paymentId, allocatedPaise: allocated, unallocatedPaise: amount - allocated, allocations: resolved }; break;
      }
      case "apply_payment_credit": {
        const paymentId = str(p.paymentId, "Payment", true); const payment = await owned(db, "payments", paymentId, owner.key); if (payment.status !== "recorded") throw new ApiError(409, "Reversed payments cannot be applied.");
        const allocatedRow = await one<{ amount: number }>(db.prepare("SELECT COALESCE(SUM(amount_paise),0) amount FROM payment_allocations WHERE owner_key=? AND payment_id=? AND reversed=0").bind(owner.key, paymentId));
        const available = Number(payment.amount_paise) - Number(allocatedRow?.amount || 0); if (available <= 0) throw new ApiError(409, "This payment has no unapplied credit.");
        const requested = Array.isArray(p.allocations) ? p.allocations : []; const resolved = await validateManualAllocations(db, owner.key, String(payment.tenancy_id), available, requested); if (!resolved.length) throw new ApiError(400, "Choose at least one open charge.");
        const applied = resolved.reduce((sum, allocation) => sum + allocation.amountPaise, 0); const at = now(); const statements: D1PreparedStatement[] = [];
        for (const allocation of resolved) statements.push(db.prepare("INSERT INTO payment_allocations (id, owner_key, payment_id, charge_type, charge_id, amount_paise, reversed, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?) ON CONFLICT(payment_id, charge_type, charge_id) DO UPDATE SET amount_paise=payment_allocations.amount_paise+excluded.amount_paise").bind(id("alloc"), owner.key, paymentId, allocation.chargeType, allocation.chargeId, allocation.amountPaise, at));
        statements.push(audit(db, owner, "payment.credit_applied", "payment", paymentId, `Applied ${applied} paise of existing credit`)); await db.batch(statements); result = { id: paymentId, appliedPaise: applied, remainingPaise: available - applied }; break;
      }
      case "reverse_payment": {
        const paymentId = str(p.paymentId, "Payment", true); const payment = await owned(db, "payments", paymentId, owner.key);
        if (payment.status === "reversed") throw new ApiError(409, "This payment is already reversed.");
        const reason = str(p.reason, "Reversal reason", true); const at = now();
        await db.batch([db.prepare("UPDATE payments SET status='reversed', reversed_at=?, reversal_reason=?, updated_at=? WHERE id=? AND owner_key=?").bind(at, reason, at, paymentId, owner.key), db.prepare("UPDATE payment_allocations SET reversed=1, reversed_at=? WHERE payment_id=? AND owner_key=?").bind(at, paymentId, owner.key), db.prepare("UPDATE receipts SET status='void' WHERE payment_id=? AND owner_key=?").bind(paymentId, owner.key), audit(db, owner, "payment.reversed", "payment", paymentId, `Payment reversed: ${reason}`)]);
        result = { id: paymentId }; break;
      }
      case "issue_receipt": {
        const paymentId = str(p.paymentId, "Payment", true); const payment = await owned(db, "payments", paymentId, owner.key);
        if (payment.status !== "recorded") throw new ApiError(409, "A reversed payment cannot receive a receipt.");
        const existing = await one(db.prepare("SELECT * FROM receipts WHERE owner_key=? AND payment_id=?").bind(owner.key, paymentId)); if (existing) { result = existing; break; }
        const details = await one(db.prepare("SELECT t.full_name, r.room_number, pr.name property_name FROM tenancies tn JOIN tenants t ON t.id=tn.tenant_id JOIN rooms r ON r.id=tn.room_id JOIN properties pr ON pr.id=tn.property_id WHERE tn.id=? AND tn.owner_key=?").bind(payment.tenancy_id, owner.key));
        const allocations = await rows(db.prepare("SELECT charge_type, charge_id, amount_paise FROM payment_allocations WHERE owner_key=? AND payment_id=? AND reversed=0").bind(owner.key, paymentId));
        const settings = await one<Record<string, unknown>>(db.prepare("SELECT * FROM settings WHERE owner_key=?").bind(owner.key)); const prefix = String(settings?.receipt_prefix ?? "RF-RCPT"); const receiptNumber = `${prefix}-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; const receiptId = id("rcpt");
        const snapshot = JSON.stringify({ receiptNumber, paymentId, amountPaise: payment.amount_paise, paymentDate: payment.payment_date, mode: payment.mode, reference: payment.reference, tenant: details?.full_name, room: details?.room_number, property: details?.property_name, allocations, issuedAt: now() });
        await db.batch([db.prepare("INSERT INTO receipts (id, owner_key, receipt_number, payment_id, tenant_id, tenancy_id, snapshot_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'issued', ?)").bind(receiptId, owner.key, receiptNumber, paymentId, payment.tenant_id, payment.tenancy_id, snapshot, now()), audit(db, owner, "receipt.issued", "receipt", receiptId, `Issued receipt ${receiptNumber}`)]);
        result = { id: receiptId, receiptNumber, snapshotJson: snapshot }; break;
      }
      case "deposit_transaction": {
        const tenancyId = str(p.tenancyId, "Tenancy", true); await owned(db, "tenancies", tenancyId, owner.key); const type = str(p.type, "Type", true);
        if (!new Set(["received", "adjustment", "deduction", "refund"]).has(type)) throw new ApiError(400, "Deposit transaction type is invalid.");
        const amount = money(p.amountPaise, "Amount"); const held = await depositBalance(db, owner.key, tenancyId); if ((type === "deduction" || type === "refund") && amount > held) throw new ApiError(400, `Only ${held} paise is currently held. Record any excess as ordinary outstanding debt.`);
        const entityId = id("dep"); await db.batch([db.prepare("INSERT INTO deposit_ledger (id, owner_key, tenancy_id, type, amount_paise, date, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(entityId, owner.key, tenancyId, type, amount, isoDate(p.date, "Date"), str(p.description, "Description"), now(), now()), audit(db, owner, `deposit.${type}`, "deposit", entityId, `${type} deposit transaction recorded`)]); result = { id: entityId, balancePaise: type === "received" || type === "adjustment" ? held + amount : held - amount }; break;
      }
      case "create_follow_up": {
        const tenantId = str(p.tenantId, "Tenant", true); await owned(db, "tenants", tenantId, owner.key); const tenancyId = str(p.tenancyId, "Tenancy"); if (tenancyId) await owned(db, "tenancies", tenancyId, owner.key);
        const entityId = id("follow"); const at = now(); await db.batch([db.prepare("INSERT INTO follow_ups (id, owner_key, tenant_id, tenancy_id, note, next_follow_up_date, promised_payment_date, status, reminder_draft, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)").bind(entityId, owner.key, tenantId, tenancyId || null, str(p.note, "Follow-up note", true), optionalDate(p.nextFollowUpDate, "Next follow-up date"), optionalDate(p.promisedPaymentDate, "Promised payment date"), str(p.reminderDraft, "Reminder draft"), at, at), audit(db, owner, "follow_up.created", "follow_up", entityId, "Created tenant follow-up")]); result = { id: entityId }; break;
      }
      case "complete_follow_up": {
        const entityId = str(p.id, "Follow-up", true); await owned(db, "follow_ups", entityId, owner.key); const at = now(); await db.batch([db.prepare("UPDATE follow_ups SET status='completed', completed_at=?, updated_at=? WHERE id=? AND owner_key=?").bind(at, at, entityId, owner.key), audit(db, owner, "follow_up.completed", "follow_up", entityId, "Completed tenant follow-up")]); result = { id: entityId }; break;
      }
      case "create_expense": {
        const propertyId = str(p.propertyId, "Property", true); await owned(db, "properties", propertyId, owner.key); const roomId = str(p.roomId, "Room"); if (roomId) { const room = await owned(db, "rooms", roomId, owner.key); if (String(room.property_id) !== propertyId) throw new ApiError(400, "The selected room does not belong to this property."); }
        const paymentStatus = enumValue(p.paymentStatus, "Payment status", ["unpaid", "paid"], "unpaid"); const incurredDate = isoDate(p.incurredDate, "Incurred date"); const paidDate = paymentStatus === "paid" ? optionalDate(p.paidDate || incurredDate, "Paid date") : null; const entityId = id("expense"); const at = now();
        await db.batch([db.prepare("INSERT INTO expenses (id, owner_key, property_id, room_id, category, description, amount_paise, incurred_date, paid_date, payee, payment_status, document_id, recurring_template_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(entityId, owner.key, propertyId, roomId || null, enumValue(p.category, "Category", ["repairs", "utilities", "cleaning", "tax", "insurance", "management", "other"], "other"), str(p.description, "Description", true), money(p.amountPaise, "Amount"), incurredDate, paidDate, str(p.payee, "Payee"), paymentStatus, str(p.documentId, "Document") || null, str(p.recurringTemplateId, "Recurring template") || null, at, at), audit(db, owner, "expense.created", "expense", entityId, `Recorded ${paymentStatus} operating expense`)]); result = { id: entityId }; break;
      }
      case "mark_expense_paid": {
        const entityId = str(p.id, "Expense", true); await owned(db, "expenses", entityId, owner.key); const paidDate = isoDate(p.paidDate, "Paid date"); await db.batch([db.prepare("UPDATE expenses SET payment_status='paid', paid_date=?, updated_at=? WHERE id=? AND owner_key=?").bind(paidDate, now(), entityId, owner.key), audit(db, owner, "expense.paid", "expense", entityId, `Marked expense paid on ${paidDate}`)]); result = { id: entityId }; break;
      }
      case "create_recurring_expense": {
        const propertyId = str(p.propertyId, "Property", true); await owned(db, "properties", propertyId, owner.key); const roomId = str(p.roomId, "Room"); if (roomId) await owned(db, "rooms", roomId, owner.key); const entityId = id("recurring"); const at = now(); await db.batch([db.prepare("INSERT INTO recurring_expense_templates (id, owner_key, property_id, room_id, category, description, amount_paise, payee, day_of_month, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)").bind(entityId, owner.key, propertyId, roomId || null, enumValue(p.category, "Category", ["repairs", "utilities", "cleaning", "tax", "insurance", "management", "other"], "other"), str(p.description, "Description", true), money(p.amountPaise, "Amount"), str(p.payee, "Payee"), int(p.dayOfMonth ?? 1, "Day of month", 1, 28), at, at), audit(db, owner, "expense_template.created", "recurring_expense", entityId, "Created recurring expense template")]); result = { id: entityId }; break;
      }
      case "generate_recurring_expenses": {
        const billingMonth = month(p.billingMonth); const templates = await rows<Record<string, unknown>>(db.prepare("SELECT * FROM recurring_expense_templates WHERE owner_key=? AND active=1").bind(owner.key)); const at = now(); const statements: D1PreparedStatement[] = []; let skipped = 0;
        for (const template of templates) { const incurredDate = `${billingMonth}-${String(template.day_of_month).padStart(2, "0")}`; const exists = await one(db.prepare("SELECT id FROM expenses WHERE owner_key=? AND recurring_template_id=? AND substr(incurred_date,1,7)=? LIMIT 1").bind(owner.key, template.id, billingMonth)); if (exists) { skipped += 1; continue; } statements.push(db.prepare("INSERT INTO expenses (id, owner_key, property_id, room_id, category, description, amount_paise, incurred_date, payee, payment_status, recurring_template_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?)").bind(id("expense"), owner.key, template.property_id, template.room_id, template.category, template.description, template.amount_paise, incurredDate, template.payee, template.id, at, at)); }
        if (statements.length) await db.batch([...statements, audit(db, owner, "expenses.generated", "expense", billingMonth, `Generated ${statements.length} recurring expense(s); ${skipped} skipped`)]); result = { inserted: statements.length, skipped }; break;
      }
      case "restore_backup": {
        const backup = safeJson(p.backup); const schemaVersion = Number(backup.schemaVersion); const workspace = safeJson(backup.workspace); const records = safeJson(backup.records); const errors: string[] = []; const warnings = ["Private document bytes are not included in structured backups; document metadata will not be restored."];
        if (schemaVersion !== 4) errors.push("This restore requires a RentFlow schema version 4 backup.");
        if (String(workspace.id || "") !== owner.key) errors.push("This backup belongs to a different workspace and cannot be restored here.");
        const tableCounts: Record<string, number> = {}; let totalRows = 0;
        for (const table of RESTORE_TABLES) { const source = records[table]; if (source != null && !Array.isArray(source)) errors.push(`${table} must be an array.`); const count = Array.isArray(source) ? source.length : 0; tableCounts[table] = count; totalRows += count; if (Array.isArray(source) && table !== "settings") { const ids = source.map((row) => String(safeJson(row).id || "")).filter(Boolean); if (new Set(ids).size !== ids.length) errors.push(`${table} contains duplicate IDs.`); } }
        const occupiedTables: string[] = [];
        for (const table of RESTORE_TABLES.filter((name) => !["audit_log", "documents"].includes(name))) { const existing = await one<{ n: number }>(db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE owner_key=?`).bind(owner.key)); if (Number(existing?.n || 0) > 0) occupiedTables.push(table); }
        if (occupiedTables.length) errors.push(`Restore is blocked because this workspace already contains data in: ${occupiedTables.join(", ")}. Export it first, then use the typed erase workflow if you intend to restore this backup.`);
        const preview = { schemaVersion, totalRows, tableCounts, errors, warnings, canCommit: errors.length === 0 };
        if (!Boolean(p.commit)) { result = preview; break; }
        if (errors.length) throw new ApiError(409, errors[0]);
        const statements: D1PreparedStatement[] = [];
        for (const table of RESTORE_TABLES) { if (table === "documents") continue; const source = Array.isArray(records[table]) ? records[table] : []; for (const sourceRow of source) { const row = safeJson(sourceRow); const columns = Object.keys(row).filter((key) => key !== "owner_key" && /^[a-z][a-z0-9_]*$/.test(key)); const values = columns.map((key) => normalizeImportValue(row[key])); statements.push(db.prepare(`INSERT INTO ${table} (owner_key${columns.length ? `,${columns.join(",")}` : ""}) VALUES (?${columns.map(() => ",?").join("")})`).bind(owner.key, ...values)); } }
        for (let index = 0; index < statements.length; index += 50) await db.batch(statements.slice(index, index + 50));
        await db.batch([audit(db, owner, "backup.restored", "workspace", owner.key, `Restored ${statements.length} structured record(s) from schema version ${schemaVersion}`)]); result = { ...preview, inserted: statements.length }; break;
      }
      case "import_records": {
        const importType = enumValue(p.importType, "Import type", ["properties", "tenants", "rooms", "opening_balances"], "properties"); const sourceRows = Array.isArray(p.rows) ? p.rows.slice(0, 500) : []; if (!sourceRows.length) throw new ApiError(400, "The import file has no data rows."); const errors: { row: number; message: string }[] = []; const prepared: RowImport[] = []; const seen = new Set<string>();
        for (let index = 0; index < sourceRows.length; index += 1) { try { const row = safeJson(sourceRows[index]); if (importType === "properties") { const name = str(row.name, "Property name", true); const key = name.toLowerCase(); if (seen.has(key) || await one(db.prepare("SELECT id FROM properties WHERE owner_key=? AND lower(name)=?").bind(owner.key, key))) throw new ApiError(409, "Property already exists."); seen.add(key); prepared.push({ type: importType, row: { name, address: str(row.address, "Address"), dueDay: importInteger(row.default_rent_due_day, 10, 1, 28), electricityRate: importRupees(row.default_electricity_rate), fixedCharge: importRupees(row.default_electricity_fixed_charge) } }); }
          if (importType === "tenants") { const fullName = str(row.full_name ?? row.name, "Full name", true); const phone = str(row.phone, "Phone"); const key = `${fullName.toLowerCase()}|${phone}`; if (seen.has(key) || await one(db.prepare("SELECT id FROM tenants WHERE owner_key=? AND lower(full_name)=? AND phone=?").bind(owner.key, fullName.toLowerCase(), phone))) throw new ApiError(409, "Tenant already exists."); seen.add(key); prepared.push({ type: importType, row: { fullName, phone, email: str(row.email, "Email"), address: str(row.permanent_address, "Address"), notes: str(row.notes, "Notes") } }); }
          if (importType === "rooms") { const roomNumber = str(row.room_number, "Room number", true); const propertyName = str(row.property, "Property", true); const property = await one<Record<string, unknown>>(db.prepare("SELECT id FROM properties WHERE owner_key=? AND (id=? OR lower(name)=?) AND active=1 LIMIT 1").bind(owner.key, propertyName, propertyName.toLowerCase())); if (!property) throw new ApiError(400, "Property was not found."); const key = `${property.id}|${roomNumber.toLowerCase()}`; if (seen.has(key) || await one(db.prepare("SELECT id FROM rooms WHERE owner_key=? AND property_id=? AND normalized_room_number=?").bind(owner.key, property.id, roomNumber.toLowerCase()))) throw new ApiError(409, "Room already exists in this property."); seen.add(key); prepared.push({ type: importType, row: { propertyId: property.id, roomNumber, floor: str(row.floor, "Floor"), meterNumber: str(row.meter_number, "Meter number"), askingRent: importRupees(row.asking_rent), status: enumValue(row.status, "Status", ["vacant", "reserved", "maintenance"], "vacant") } }); }
          if (importType === "opening_balances") { const tenancyId = str(row.tenancy_id, "Tenancy ID", true); await owned(db, "tenancies", tenancyId, owner.key); const amount = importRupees(row.amount); if (amount <= 0) throw new ApiError(400, "Opening balance must be greater than zero."); prepared.push({ type: importType, row: { tenancyId, amount, date: isoDate(row.date || now().slice(0, 10), "Date"), description: str(row.description, "Description") || "Imported opening balance" } }); }
        } catch (error) { errors.push({ row: index + 2, message: error instanceof Error ? error.message : "Invalid row" }); } }
        if (!Boolean(p.commit)) { result = { totalRows: sourceRows.length, validRows: prepared.length, errors, preview: prepared.slice(0, 20).map((item) => item.row) }; break; }
        if (errors.length) throw new ApiError(400, `Fix ${errors.length} invalid import row(s) before committing.`); const at = now(); const statements: D1PreparedStatement[] = [];
        for (const item of prepared) { const row = item.row; if (item.type === "properties") statements.push(db.prepare("INSERT INTO properties (id, owner_key, name, address, notes, default_rent_due_day, default_electricity_rate_paise, default_electricity_fixed_charge_paise, default_late_fee_mode, default_late_fee_value, currency, active, created_at, updated_at) VALUES (?, ?, ?, ?, '', ?, ?, ?, 'none', 0, 'INR', 1, ?, ?)").bind(id("prop"), owner.key, row.name, row.address, row.dueDay, row.electricityRate, row.fixedCharge, at, at)); if (item.type === "tenants") statements.push(db.prepare("INSERT INTO tenants (id, owner_key, full_name, phone, email, permanent_address, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)").bind(id("tenant"), owner.key, row.fullName, row.phone, row.email, row.address, row.notes, at, at)); if (item.type === "rooms") { const roomId = id("room"); statements.push(db.prepare("INSERT INTO rooms (id, owner_key, property_id, room_number, normalized_room_number, floor, meter_number, status, notes, asking_rent_paise, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, 1, ?, ?)").bind(roomId, owner.key, row.propertyId, row.roomNumber, String(row.roomNumber).toLowerCase(), row.floor, row.meterNumber, row.status, row.askingRent, at, at), db.prepare("INSERT INTO room_availability_history (id, owner_key, room_id, status, effective_from, reason, created_at) VALUES (?, ?, ?, ?, ?, 'Room imported', ?)").bind(id("avail"), owner.key, roomId, row.status, at.slice(0, 10), at)); } if (item.type === "opening_balances") statements.push(db.prepare("INSERT INTO other_charges (id, owner_key, tenancy_id, charge_date, charge_type, amount_paise, description, reversed, created_at, updated_at) VALUES (?, ?, ?, ?, 'opening_balance', ?, ?, 0, ?, ?)").bind(id("other"), owner.key, row.tenancyId, row.date, row.amount, row.description, at, at)); }
        statements.push(audit(db, owner, "import.committed", "import", importType, `Imported ${prepared.length} ${importType.replaceAll("_", " ")} row(s)`)); await db.batch(statements); result = { inserted: prepared.length, errors: [] }; break;
      }
      case "create_maintenance": {
        const propertyId = str(p.propertyId, "Property", true); await owned(db, "properties", propertyId, owner.key); const roomId = str(p.roomId, "Room"); if (roomId) await owned(db, "rooms", roomId, owner.key); const entityId = id("maint"); const at = now();
        await db.batch([db.prepare("INSERT INTO maintenance_issues (id, owner_key, property_id, room_id, title, description, priority, status, reported_date, due_date, assigned_to, estimated_cost_paise, actual_cost_paise, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, 0, ?, ?)").bind(entityId, owner.key, propertyId, roomId || null, str(p.title, "Issue title", true), str(p.description, "Description"), enumValue(p.priority, "Priority", ["low", "normal", "high", "urgent"], "normal"), isoDate(p.reportedDate, "Reported date"), optionalDate(p.dueDate, "Due date"), str(p.assignedTo, "Assigned contact"), money(p.estimatedCostPaise ?? 0, "Estimated cost", true), at, at), audit(db, owner, "maintenance.created", "maintenance", entityId, "Created maintenance issue")]); result = { id: entityId }; break;
      }
      case "update_maintenance": {
        const entityId = str(p.id, "Maintenance issue", true); const issue = await owned(db, "maintenance_issues", entityId, owner.key); const status = enumValue(p.status, "Status", ["open", "in_progress", "completed", "cancelled"], "open"); const actual = money(p.actualCostPaise ?? 0, "Actual cost", true); const at = now(); const completedDate = status === "completed" ? optionalDate(p.completedDate || at.slice(0, 10), "Completed date") : null; const statements: D1PreparedStatement[] = [db.prepare("UPDATE maintenance_issues SET status=?, completed_date=?, assigned_to=?, actual_cost_paise=?, updated_at=? WHERE id=? AND owner_key=?").bind(status, completedDate, str(p.assignedTo, "Assigned contact"), actual, at, entityId, owner.key)];
        if (status === "completed" && Boolean(p.createExpense) && actual > 0 && !issue.expense_id) { const expenseId = id("expense"); statements.push(db.prepare("INSERT INTO expenses (id, owner_key, property_id, room_id, category, description, amount_paise, incurred_date, paid_date, payee, payment_status, created_at, updated_at) VALUES (?, ?, ?, ?, 'repairs', ?, ?, ?, ?, ?, 'paid', ?, ?)").bind(expenseId, owner.key, issue.property_id, issue.room_id, issue.title, actual, completedDate, completedDate, str(p.assignedTo, "Assigned contact"), at, at), db.prepare("UPDATE maintenance_issues SET expense_id=? WHERE id=? AND owner_key=?").bind(expenseId, entityId, owner.key)); }
        statements.push(audit(db, owner, "maintenance.updated", "maintenance", entityId, `Maintenance marked ${status}`)); await db.batch(statements); result = { id: entityId }; break;
      }
      case "replace_meter": {
        const tenancyId = str(p.tenancyId, "Tenancy", true); const tenancy = await owned(db, "tenancies", tenancyId, owner.key); const room = await owned(db, "rooms", String(tenancy.room_id), owner.key); const entityId = id("meter"); const at = now(); const eventDate = isoDate(p.eventDate, "Replacement date"); const oldFinal = num(p.oldFinalReading, "Old final reading", 0); const newInitial = num(p.newInitialReading, "New initial reading", 0); const newMeter = str(p.newMeterNumber, "New meter number", true); const reason = str(p.reason, "Replacement reason", true);
        await db.batch([db.prepare("INSERT INTO meter_events (id, owner_key, tenancy_id, room_id, event_date, old_meter_number, new_meter_number, old_final_reading, new_initial_reading, reason, photo_document_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(entityId, owner.key, tenancyId, tenancy.room_id, eventDate, room.meter_number, newMeter, oldFinal, newInitial, reason, str(p.photoDocumentId, "Photo document") || null, at), db.prepare("UPDATE rooms SET meter_number=?, updated_at=? WHERE id=? AND owner_key=?").bind(newMeter, at, tenancy.room_id, owner.key), audit(db, owner, "meter.replaced", "meter_event", entityId, `Replaced meter ${String(room.meter_number)} with ${newMeter}`)]); result = { id: entityId }; break;
      }
      case "settle_move_out": {
        const tenancyId = str(p.tenancyId, "Tenancy", true); const tenancy = await owned(db, "tenancies", tenancyId, owner.key); if (!new Set(["active", "notice"]).has(String(tenancy.status))) throw new ApiError(409, "This tenancy is already closed."); const existing = await one(db.prepare("SELECT id FROM move_out_settlements WHERE tenancy_id=? AND owner_key=?").bind(tenancyId, owner.key)); if (existing) throw new ApiError(409, "A settlement already exists for this tenancy.");
        const open = await openCharges(db, owner.key, tenancyId); const outstanding = open.reduce((sum, charge) => sum + Number(charge.balance_paise), 0); const paymentsTotal = await one<{ amount: number }>(db.prepare("SELECT COALESCE(SUM(amount_paise),0) amount FROM payments WHERE owner_key=? AND tenancy_id=? AND status='recorded'").bind(owner.key, tenancyId)); const allocationsTotal = await one<{ amount: number }>(db.prepare("SELECT COALESCE(SUM(a.amount_paise),0) amount FROM payment_allocations a JOIN payments p ON p.id=a.payment_id WHERE p.owner_key=? AND p.tenancy_id=? AND p.status='recorded' AND a.reversed=0").bind(owner.key, tenancyId)); const credit = Math.max(0, Number(paymentsTotal?.amount || 0) - Number(allocationsTotal?.amount || 0)); const held = await depositBalance(db, owner.key, tenancyId); const deduction = money(p.deductionPaise ?? 0, "Deposit deduction", true); if (deduction > held) throw new ApiError(400, "Deposit deduction cannot exceed the deposit held."); const refund = held - deduction; const remainingDebt = Math.max(0, outstanding - credit - deduction); const settlementDate = isoDate(p.settlementDate, "Settlement date"); const entityId = id("settle"); const settlementCreditId = deduction > 0 ? id("other") : null; const at = now(); const snapshot = JSON.stringify({ tenancyId, settlementDate, outstandingPaise: outstanding, creditPaise: credit, depositHeldPaise: held, deductionPaise: deduction, refundPaise: refund, remainingDebtPaise: remainingDebt, depositCreditChargeId: settlementCreditId, openCharges: open, createdAt: at }); const statements: D1PreparedStatement[] = [db.prepare("INSERT INTO move_out_settlements (id, owner_key, tenancy_id, settlement_date, outstanding_paise, credit_paise, deposit_held_paise, deduction_paise, refund_paise, remaining_debt_paise, notes, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(entityId, owner.key, tenancyId, settlementDate, outstanding, credit, held, deduction, refund, remainingDebt, str(p.notes, "Notes"), snapshot, at), db.prepare("UPDATE tenancies SET status='moved_out', move_out_date=?, updated_at=? WHERE id=? AND owner_key=?").bind(settlementDate, at, tenancyId, owner.key), db.prepare("UPDATE rooms SET status='vacant', updated_at=? WHERE id=? AND owner_key=?").bind(at, tenancy.room_id, owner.key), ...availabilityStatements(db, owner.key, String(tenancy.room_id), "vacant", settlementDate, "Move-out settlement", at)];
        if (deduction > 0) statements.push(db.prepare("INSERT INTO other_charges (id, owner_key, tenancy_id, charge_date, charge_type, amount_paise, description, reversed, created_at, updated_at) VALUES (?, ?, ?, ?, 'deposit_settlement_credit', ?, 'Deposit applied in move-out settlement', 0, ?, ?)").bind(settlementCreditId, owner.key, tenancyId, settlementDate, -deduction, at, at), db.prepare("INSERT INTO deposit_ledger (id, owner_key, tenancy_id, type, amount_paise, date, description, related_charge_id, created_at, updated_at) VALUES (?, ?, ?, 'deduction', ?, ?, 'Applied in move-out settlement', ?, ?, ?)").bind(id("dep"), owner.key, tenancyId, deduction, settlementDate, settlementCreditId, at, at)); if (refund > 0) statements.push(db.prepare("INSERT INTO deposit_ledger (id, owner_key, tenancy_id, type, amount_paise, date, description, created_at, updated_at) VALUES (?, ?, ?, 'refund', ?, ?, 'Refund due in move-out settlement', ?, ?)").bind(id("dep"), owner.key, tenancyId, refund, settlementDate, at, at)); statements.push(audit(db, owner, "tenancy.settled", "move_out_settlement", entityId, `Move-out settlement completed; remaining debt ${remainingDebt} paise`)); await db.batch(statements); result = { id: entityId, outstandingPaise: outstanding, creditPaise: credit, depositHeldPaise: held, deductionPaise: deduction, refundPaise: refund, remainingDebtPaise: remainingDebt }; break;
      }
      case "update_settings": {
        const landlordName = str(p.landlordName, "Landlord name"); const at = now();
        await db.batch([db.prepare("INSERT INTO settings (owner_key, landlord_name, currency, timezone, date_format, bill_prefix, receipt_prefix, default_rent_due_day, upi_id, payment_instructions, bill_footer, default_electricity_rate_paise, default_electricity_fixed_charge_paise, max_file_size_mb, created_at, updated_at) VALUES (?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_key) DO UPDATE SET landlord_name=excluded.landlord_name, timezone=excluded.timezone, date_format=excluded.date_format, bill_prefix=excluded.bill_prefix, receipt_prefix=excluded.receipt_prefix, default_rent_due_day=excluded.default_rent_due_day, upi_id=excluded.upi_id, payment_instructions=excluded.payment_instructions, bill_footer=excluded.bill_footer, default_electricity_rate_paise=excluded.default_electricity_rate_paise, default_electricity_fixed_charge_paise=excluded.default_electricity_fixed_charge_paise, max_file_size_mb=excluded.max_file_size_mb, updated_at=excluded.updated_at").bind(owner.key, landlordName, str(p.timezone, "Timezone") || "Asia/Kolkata", str(p.dateFormat, "Date format") || "dd MMM yyyy", str(p.billPrefix, "Bill prefix") || "RF-BILL", str(p.receiptPrefix, "Receipt prefix") || "RF-RCPT", int(p.defaultRentDueDay ?? 10, "Default due day", 1, 28), str(p.upiId, "UPI ID"), str(p.paymentInstructions, "Payment instructions"), str(p.billFooter, "Bill footer"), money(p.defaultElectricityRatePaise ?? 0, "Electricity rate", true), money(p.defaultElectricityFixedChargePaise ?? 0, "Fixed charge", true), int(p.maxFileSizeMb ?? 20, "File size", 1, 100), at, at), audit(db, owner, "settings.updated", "settings", owner.key, "Updated billing and payment settings")]); result = { ok: true }; break;
      }
      case "erase_all": {
        if (p.confirmation !== "DELETE ALL RENTFLOW DATA") throw new ApiError(400, "Type DELETE ALL RENTFLOW DATA exactly to continue.");
        const docs = await rows<{ object_key: string }>(db.prepare("SELECT object_key FROM documents WHERE owner_key=?").bind(owner.key));
        if (docs.length) await Promise.all(docs.map((d) => bucket().delete(d.object_key)));
        const tables = ["move_out_settlements", "meter_events", "maintenance_issues", "recurring_expense_templates", "expenses", "follow_ups", "room_availability_history", "payment_allocations", "receipts", "payments", "deposit_ledger", "electricity_bills", "electricity_readings", "rent_charges", "other_charges", "electricity_rate_history", "rent_rate_history", "documents", "tenancies", "rooms", "tenants", "properties", "settings", "audit_log"];
        await db.batch(tables.map((table) => db.prepare(`DELETE FROM ${table} WHERE owner_key=?`).bind(owner.key)));
        result = { deleted: true }; break;
      }
      default: throw new ApiError(400, "Unsupported action.");
    }
    return Response.json({ ok: true, result });
  } catch (error) { return jsonError(error); }
}

function money(value: unknown, label: string, allowZero = false, allowNegative = false) {
  const out = int(value, label); if (!allowNegative && out < 0) throw new ApiError(400, `${label} cannot be negative.`); if (!allowZero && out === 0) throw new ApiError(400, `${label} must be greater than zero.`); return out;
}
type RowImport = { type: string; row: Record<string, any> };
const RESTORE_TABLES = ["properties", "rooms", "tenants", "tenancies", "rent_rate_history", "electricity_rate_history", "rent_charges", "electricity_readings", "electricity_bills", "other_charges", "payments", "payment_allocations", "deposit_ledger", "receipts", "documents", "follow_ups", "expenses", "recurring_expense_templates", "maintenance_issues", "room_availability_history", "meter_events", "move_out_settlements", "settings", "audit_log"];
function normalizeImportValue(value: unknown) { if (value == null || typeof value === "string" || typeof value === "number") return value; if (typeof value === "boolean") return value ? 1 : 0; return JSON.stringify(value); }
function importRupees(value: unknown) {
  if (value == null || String(value).trim() === "") return 0;
  const parsed = Number(String(value).replace(/[,₹\s]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) throw new ApiError(400, "Amount is invalid.");
  return Math.round(parsed * 100);
}
function importInteger(value: unknown, fallback: number, min: number, max: number) {
  if (value == null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new ApiError(400, `Value must be a whole number from ${min} to ${max}.`);
  return parsed;
}
function maskId(value: string) { if (!value) return ""; const clean = value.replace(/\s+/g, ""); return clean.length <= 4 ? "••••" : `${"•".repeat(Math.min(8, clean.length - 4))}${clean.slice(-4)}`; }
function optionalDate(value: unknown, label: string) { const candidate = str(value, label); return candidate ? isoDate(candidate, label) : null; }
function enumValue(value: unknown, label: string, allowed: string[], fallback: string) { const candidate = str(value, label) || fallback; if (!allowed.includes(candidate)) throw new ApiError(400, `${label} is invalid.`); return candidate; }
function monthEnd(billingMonth: string) { const [y, m] = billingMonth.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
function availabilityStatements(db: D1Database, ownerKey: string, roomId: string, status: string, effectiveFrom: string, reason: string, at: string) { return [db.prepare("UPDATE room_availability_history SET effective_to=date(?, '-1 day') WHERE owner_key=? AND room_id=? AND effective_to IS NULL").bind(effectiveFrom, ownerKey, roomId), db.prepare("INSERT INTO room_availability_history (id, owner_key, room_id, status, effective_from, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id("avail"), ownerKey, roomId, status, effectiveFrom, reason, at)]; }
async function owned(db: D1Database, table: string, entityId: string, ownerKey: string) { const allowed = new Set(["properties", "rooms", "tenants", "tenancies", "payments", "electricity_readings", "documents", "expenses", "maintenance_issues", "follow_ups"]); if (!allowed.has(table)) throw new ApiError(500, "Invalid entity lookup."); const record = await one<Record<string, unknown>>(db.prepare(`SELECT * FROM ${table} WHERE id=? AND owner_key=?`).bind(entityId, ownerKey)); if (!record) throw new ApiError(404, "Record not found."); return record; }
async function depositBalance(db: D1Database, ownerKey: string, tenancyId: string) { const r = await one<{ balance: number }>(db.prepare("SELECT COALESCE(SUM(CASE WHEN type IN ('received','adjustment') THEN amount_paise ELSE -amount_paise END),0) balance FROM deposit_ledger WHERE owner_key=? AND tenancy_id=?").bind(ownerKey, tenancyId)); return Number(r?.balance ?? 0); }

async function openCharges(db: D1Database, ownerKey: string, tenancyId: string) {
  return rows<{ charge_type: string; charge_id: string; amount_paise: number; due_date: string; balance_paise: number }>(db.prepare(`
    SELECT c.charge_type, c.charge_id, c.amount_paise, c.due_date, c.amount_paise-COALESCE(SUM(a.amount_paise),0) balance_paise FROM (
      SELECT 'rent' charge_type, id charge_id, amount_paise, due_date FROM rent_charges WHERE owner_key=? AND tenancy_id=? AND reversed=0
      UNION ALL SELECT 'electricity', id, total_paise, COALESCE(due_date, billing_month||'-28') FROM electricity_bills WHERE owner_key=? AND tenancy_id=? AND reversed=0
      UNION ALL SELECT 'other', id, amount_paise, charge_date FROM other_charges WHERE owner_key=? AND tenancy_id=? AND reversed=0 AND amount_paise>0
    ) c LEFT JOIN payment_allocations a ON a.charge_type=c.charge_type AND a.charge_id=c.charge_id AND a.reversed=0
    GROUP BY c.charge_type,c.charge_id,c.amount_paise,c.due_date HAVING balance_paise>0
    ORDER BY c.due_date, CASE c.charge_type WHEN 'rent' THEN 1 WHEN 'electricity' THEN 2 ELSE 3 END
  `).bind(ownerKey, tenancyId, ownerKey, tenancyId, ownerKey, tenancyId));
}
async function automaticAllocations(db: D1Database, ownerKey: string, tenancyId: string, amount: number) { const open = await openCharges(db, ownerKey, tenancyId); let remaining = amount; const out: { chargeType: string; chargeId: string; amountPaise: number }[] = []; for (const c of open) { if (remaining <= 0) break; const applied = Math.min(remaining, Number(c.balance_paise)); if (applied > 0) { out.push({ chargeType: c.charge_type, chargeId: c.charge_id, amountPaise: applied }); remaining -= applied; } } return out; }
async function validateManualAllocations(db: D1Database, ownerKey: string, tenancyId: string, amount: number, allocations: unknown[]) { const open = await openCharges(db, ownerKey, tenancyId); const balances = new Map(open.map((c) => [`${c.charge_type}:${c.charge_id}`, Number(c.balance_paise)])); let total = 0; const out: { chargeType: string; chargeId: string; amountPaise: number }[] = []; for (const raw of allocations) { const a = safeJson(raw); const chargeType = str(a.chargeType, "Charge type", true); const chargeId = str(a.chargeId, "Charge", true); const applied = money(a.amountPaise, "Allocation amount"); if (!CHARGE_TYPES.has(chargeType)) throw new ApiError(400, "Allocation charge type is invalid."); const balance = balances.get(`${chargeType}:${chargeId}`); if (balance == null) throw new ApiError(400, "An allocation target is not an open charge for this tenancy."); if (applied > balance) throw new ApiError(400, "An allocation exceeds the charge balance."); total += applied; out.push({ chargeType, chargeId, amountPaise: applied }); } if (total > amount) throw new ApiError(400, "Allocations cannot exceed the payment amount."); return out; }
