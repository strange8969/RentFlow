import { ApiError, audit, database, id, int, isoDate, jsonError, month, now, num, one, requireOwner, rows, safeJson, str, bucket } from "../_lib";

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
          db.prepare("INSERT INTO rooms (id, owner_key, property_id, room_number, normalized_room_number, floor, meter_number, status, notes, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)").bind(entityId, owner.key, propertyId, roomNumber, roomNumber.trim().toLowerCase(), str(p.floor, "Floor"), str(p.meterNumber, "Meter number"), status, str(p.notes, "Notes"), at, at),
          audit(db, owner, "room.created", "room", entityId, `Created room ${roomNumber}`),
        ]);
        result = { id: entityId };
        break;
      }
      case "archive_room": {
        const entityId = str(p.id, "Room", true);
        const room = await owned(db, "rooms", entityId, owner.key);
        const activeTenancy = await one(db.prepare("SELECT id FROM tenancies WHERE owner_key=? AND room_id=? AND status IN ('active','notice') LIMIT 1").bind(owner.key, entityId));
        if (activeTenancy) throw new ApiError(409, "Move out the active tenancy before archiving this room.");
        await db.batch([db.prepare("UPDATE rooms SET active=0, status='maintenance', updated_at=? WHERE id=? AND owner_key=?").bind(now(), entityId, owner.key), audit(db, owner, "room.archived", "room", entityId, `Archived room ${String(room.room_number)}`)]);
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
          db.prepare("INSERT INTO tenancies (id, owner_key, property_id, room_id, tenant_id, move_in_date, rent_start_date, rent_due_day, security_deposit_required_paise, opening_balance_paise, initial_meter_reading, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)").bind(entityId, owner.key, propertyId, roomId, tenantId, moveIn, rentStart, dueDay, depositRequired, openingBalance, initialMeter, at, at),
          db.prepare("INSERT INTO rent_rate_history (id, owner_key, tenancy_id, amount_paise, effective_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id("rr"), owner.key, entityId, rent, rentStart, at, at),
          db.prepare("INSERT INTO electricity_rate_history (id, owner_key, tenancy_id, rate_paise_per_unit, fixed_charge_paise, effective_from, tariff_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)").bind(id("er"), owner.key, entityId, electricityRate, fixed, rentStart, at, at),
          db.prepare("UPDATE rooms SET status='occupied', updated_at=? WHERE id=? AND owner_key=?").bind(at, roomId, owner.key),
          audit(db, owner, "tenancy.activated", "tenancy", entityId, `Activated tenancy in room ${String(room.room_number)}`),
        ];
        if (depositReceived > 0) statements.push(db.prepare("INSERT INTO deposit_ledger (id, owner_key, tenancy_id, type, amount_paise, date, description, created_at, updated_at) VALUES (?, ?, ?, 'received', ?, ?, 'Deposit received at move-in', ?, ?)").bind(id("dep"), owner.key, entityId, depositReceived, moveIn, at, at));
        if (openingBalance > 0) statements.push(db.prepare("INSERT INTO other_charges (id, owner_key, tenancy_id, charge_date, charge_type, amount_paise, description, reversed, created_at, updated_at) VALUES (?, ?, ?, ?, 'opening_balance', ?, 'Opening balance at move-in', 0, ?, ?)").bind(id("other"), owner.key, entityId, moveIn, openingBalance, at, at));
        await db.batch(statements); result = { id: entityId }; break;
      }
      case "set_notice": {
        const entityId = str(p.tenancyId, "Tenancy", true); await owned(db, "tenancies", entityId, owner.key);
        const noticeDate = isoDate(p.noticeDate, "Notice date");
        await db.batch([db.prepare("UPDATE tenancies SET status='notice', notice_date=?, updated_at=? WHERE id=? AND owner_key=? AND status='active'").bind(noticeDate, now(), entityId, owner.key), audit(db, owner, "tenancy.notice", "tenancy", entityId, `Notice recorded for ${noticeDate}`)]);
        result = { id: entityId }; break;
      }
      case "move_out": {
        const entityId = str(p.tenancyId, "Tenancy", true); const tenancy = await owned(db, "tenancies", entityId, owner.key);
        if (!new Set(["active", "notice"]).has(String(tenancy.status))) throw new ApiError(409, "This tenancy is already closed.");
        const moveOutDate = isoDate(p.moveOutDate, "Move-out date");
        await db.batch([
          db.prepare("UPDATE tenancies SET status='moved_out', move_out_date=?, updated_at=? WHERE id=? AND owner_key=?").bind(moveOutDate, now(), entityId, owner.key),
          db.prepare("UPDATE rooms SET status='vacant', updated_at=? WHERE id=? AND owner_key=?").bind(now(), tenancy.room_id, owner.key),
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
      case "generate_rent": {
        const billingMonth = month(p.billingMonth); const propertyId = str(p.propertyId, "Property");
        const periodStart = `${billingMonth}-01`; const periodEnd = monthEnd(billingMonth); const params: unknown[] = [owner.key, periodEnd, periodStart];
        let query = "SELECT * FROM tenancies WHERE owner_key=? AND rent_start_date<=? AND (move_out_date IS NULL OR move_out_date>=?)";
        if (propertyId) { query += " AND property_id=?"; params.push(propertyId); }
        const active = await rows<Record<string, unknown>>(db.prepare(query).bind(...params));
        const inserts: D1PreparedStatement[] = []; let skipped = 0; const at = now();
        for (const tenancy of active) {
          const exists = await one(db.prepare("SELECT id FROM rent_charges WHERE tenancy_id=? AND billing_month=? AND source='generated'").bind(tenancy.id, billingMonth));
          if (exists) { skipped++; continue; }
          const rate = await one<{ amount_paise: number }>(db.prepare("SELECT amount_paise FROM rent_rate_history WHERE owner_key=? AND tenancy_id=? AND effective_from<=? AND (effective_to IS NULL OR effective_to>=?) ORDER BY effective_from DESC LIMIT 1").bind(owner.key, tenancy.id, periodEnd, periodStart));
          if (!rate) { skipped++; continue; }
          const due = `${billingMonth}-${String(Math.min(Number(tenancy.rent_due_day), Number(periodEnd.slice(-2)))).padStart(2, "0")}`;
          inserts.push(db.prepare("INSERT INTO rent_charges (id, owner_key, tenancy_id, billing_month, period_start, period_end, amount_paise, due_date, source, note, reversed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generated', '', 0, ?, ?)").bind(id("rent"), owner.key, tenancy.id, billingMonth, periodStart, periodEnd, rate.amount_paise, due, at, at));
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
        const paymentId = id("pay"); const at = now(); let resolved: { chargeType: string; chargeId: string; amountPaise: number }[] = [];
        if (p.allocationMode === "manual") resolved = await validateManualAllocations(db, owner.key, tenancyId, amount, Array.isArray(p.allocations) ? p.allocations : []);
        else resolved = await automaticAllocations(db, owner.key, tenancyId, amount);
        const allocated = resolved.reduce((s, a) => s + a.amountPaise, 0);
        const stmts: D1PreparedStatement[] = [db.prepare("INSERT INTO payments (id, owner_key, tenancy_id, tenant_id, amount_paise, payment_date, mode, reference, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?, ?)").bind(paymentId, owner.key, tenancyId, tenancy.tenant_id, amount, isoDate(p.paymentDate, "Payment date"), mode, str(p.reference, "Reference"), str(p.notes, "Notes"), at, at)];
        for (const a of resolved) stmts.push(db.prepare("INSERT INTO payment_allocations (id, owner_key, payment_id, charge_type, charge_id, amount_paise, reversed, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)").bind(id("alloc"), owner.key, paymentId, a.chargeType, a.chargeId, a.amountPaise, at));
        stmts.push(audit(db, owner, "payment.recorded", "payment", paymentId, `Recorded payment; allocated ${allocated} paise`)); await db.batch(stmts);
        result = { id: paymentId, allocatedPaise: allocated, unallocatedPaise: amount - allocated, allocations: resolved }; break;
      }
      case "reverse_payment": {
        const paymentId = str(p.paymentId, "Payment", true); const payment = await owned(db, "payments", paymentId, owner.key);
        if (payment.status === "reversed") throw new ApiError(409, "This payment is already reversed.");
        const reason = str(p.reason, "Reversal reason", true); const at = now();
        await db.batch([db.prepare("UPDATE payments SET status='reversed', reversed_at=?, reversal_reason=?, updated_at=? WHERE id=? AND owner_key=?").bind(at, reason, at, paymentId, owner.key), db.prepare("UPDATE payment_allocations SET reversed=1 WHERE payment_id=? AND owner_key=?").bind(paymentId, owner.key), db.prepare("UPDATE receipts SET status='void' WHERE payment_id=? AND owner_key=?").bind(paymentId, owner.key), audit(db, owner, "payment.reversed", "payment", paymentId, `Payment reversed: ${reason}`)]);
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
      case "update_settings": {
        const landlordName = str(p.landlordName, "Landlord name"); const at = now();
        await db.batch([db.prepare("INSERT INTO settings (owner_key, landlord_name, currency, timezone, date_format, bill_prefix, receipt_prefix, default_rent_due_day, upi_id, payment_instructions, bill_footer, default_electricity_rate_paise, default_electricity_fixed_charge_paise, max_file_size_mb, created_at, updated_at) VALUES (?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_key) DO UPDATE SET landlord_name=excluded.landlord_name, timezone=excluded.timezone, date_format=excluded.date_format, bill_prefix=excluded.bill_prefix, receipt_prefix=excluded.receipt_prefix, default_rent_due_day=excluded.default_rent_due_day, upi_id=excluded.upi_id, payment_instructions=excluded.payment_instructions, bill_footer=excluded.bill_footer, default_electricity_rate_paise=excluded.default_electricity_rate_paise, default_electricity_fixed_charge_paise=excluded.default_electricity_fixed_charge_paise, max_file_size_mb=excluded.max_file_size_mb, updated_at=excluded.updated_at").bind(owner.key, landlordName, str(p.timezone, "Timezone") || "Asia/Kolkata", str(p.dateFormat, "Date format") || "dd MMM yyyy", str(p.billPrefix, "Bill prefix") || "RF-BILL", str(p.receiptPrefix, "Receipt prefix") || "RF-RCPT", int(p.defaultRentDueDay ?? 10, "Default due day", 1, 28), str(p.upiId, "UPI ID"), str(p.paymentInstructions, "Payment instructions"), str(p.billFooter, "Bill footer"), money(p.defaultElectricityRatePaise ?? 0, "Electricity rate", true), money(p.defaultElectricityFixedChargePaise ?? 0, "Fixed charge", true), int(p.maxFileSizeMb ?? 20, "File size", 1, 100), at, at), audit(db, owner, "settings.updated", "settings", owner.key, "Updated billing and payment settings")]); result = { ok: true }; break;
      }
      case "erase_all": {
        if (p.confirmation !== "DELETE ALL RENTFLOW DATA") throw new ApiError(400, "Type DELETE ALL RENTFLOW DATA exactly to continue.");
        const docs = await rows<{ object_key: string }>(db.prepare("SELECT object_key FROM documents WHERE owner_key=?").bind(owner.key));
        if (docs.length) await Promise.all(docs.map((d) => bucket().delete(d.object_key)));
        const tables = ["payment_allocations", "receipts", "payments", "deposit_ledger", "electricity_bills", "electricity_readings", "rent_charges", "other_charges", "electricity_rate_history", "rent_rate_history", "documents", "tenancies", "rooms", "tenants", "properties", "settings", "audit_log"];
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
function maskId(value: string) { if (!value) return ""; const clean = value.replace(/\s+/g, ""); return clean.length <= 4 ? "••••" : `${"•".repeat(Math.min(8, clean.length - 4))}${clean.slice(-4)}`; }
function monthEnd(billingMonth: string) { const [y, m] = billingMonth.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
async function owned(db: D1Database, table: string, entityId: string, ownerKey: string) { const allowed = new Set(["properties", "rooms", "tenants", "tenancies", "payments", "electricity_readings"]); if (!allowed.has(table)) throw new ApiError(500, "Invalid entity lookup."); const record = await one<Record<string, unknown>>(db.prepare(`SELECT * FROM ${table} WHERE id=? AND owner_key=?`).bind(entityId, ownerKey)); if (!record) throw new ApiError(404, "Record not found."); return record; }
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
