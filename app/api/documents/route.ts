import { ApiError, audit, bucket, database, id, jsonError, now, one, requireOwner, str } from "../_lib";

export const dynamic = "force-dynamic";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

export async function POST(request: Request) {
  try {
    const owner = await requireOwner(); const db = database(); const form = await request.formData();
    const file = form.get("file"); if (!(file instanceof File)) throw new ApiError(400, "Choose a file to upload.");
    const settings = await one<{ max_file_size_mb: number }>(db.prepare("SELECT max_file_size_mb FROM settings WHERE owner_key=?").bind(owner.key)); const max = Number(settings?.max_file_size_mb ?? 20) * 1024 * 1024;
    if (file.size <= 0 || file.size > max) throw new ApiError(400, `File must be between 1 byte and ${Math.round(max / 1024 / 1024)} MB.`);
    if (!allowedTypes.has(file.type)) throw new ApiError(400, "This file type is not supported.");
    const documentId = id("doc"); const safeName = sanitize(file.name); const objectKey = `${owner.key}/${documentId}/${safeName}`;
    await bucket().put(objectKey, file.stream(), { httpMetadata: { contentType: file.type, contentDisposition: `attachment; filename="${safeName}"` } });
    try {
      const at = now();
      await db.batch([db.prepare("INSERT INTO documents (id, owner_key, tenant_id, tenancy_id, room_id, type, filename, mime_type, size, object_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(documentId, owner.key, nullable(form.get("tenantId")), nullable(form.get("tenancyId")), nullable(form.get("roomId")), str(form.get("type"), "Document type", true), safeName, file.type, file.size, objectKey, at), audit(db, owner, "document.uploaded", "document", documentId, `Uploaded ${safeName}`)]);
    } catch (error) { await bucket().delete(objectKey); throw error; }
    return Response.json({ ok: true, result: { id: documentId } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

function sanitize(name: string) { const cleaned = name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim(); return (cleaned || "document").slice(0, 120); }
function nullable(v: FormDataEntryValue | null) { return typeof v === "string" && v.trim() ? v.trim() : null; }
