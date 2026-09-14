import { ApiError, audit, bucket, database, jsonError, one, requireOwner, requirePermission } from "../../_lib";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwner(); requirePermission(owner, "exports.read"); const db = database(); const { id } = await context.params;
    const doc = await one<Record<string, unknown>>(db.prepare("SELECT * FROM documents WHERE id=? AND owner_key=?").bind(id, owner.key)); if (!doc) throw new ApiError(404, "Document not found.");
    const object = await bucket().get(String(doc.object_key)); if (!object) throw new ApiError(404, "Stored document bytes are missing.");
    return new Response(object.body, { headers: { "Content-Type": String(doc.mime_type), "Content-Disposition": `attachment; filename="${String(doc.filename).replace(/"/g, "")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwner(); requirePermission(owner, "records.write"); const db = database(); const { id } = await context.params;
    const doc = await one<Record<string, unknown>>(db.prepare("SELECT * FROM documents WHERE id=? AND owner_key=?").bind(id, owner.key)); if (!doc) throw new ApiError(404, "Document not found.");
    await bucket().delete(String(doc.object_key));
    await db.batch([db.prepare("DELETE FROM documents WHERE id=? AND owner_key=?").bind(id, owner.key), audit(db, owner, "document.deleted", "document", id, `Deleted ${String(doc.filename)}`)]);
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
