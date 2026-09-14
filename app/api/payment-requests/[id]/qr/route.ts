import QRCode from "qrcode";
import { ApiError, database, jsonError, one, requireOwner } from "../../../_lib";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwner(); const { id } = await context.params; const db = database();
    const paymentRequest = await one<Record<string, unknown>>(db.prepare("SELECT * FROM payment_requests WHERE id=? AND owner_key=?").bind(id, owner.key));
    if (!paymentRequest) throw new ApiError(404, "Payment request not found.");
    if (Date.parse(String(paymentRequest.expires_at)) <= Date.now() && paymentRequest.status === "pending") {
      await db.prepare("UPDATE payment_requests SET status='expired',updated_at=? WHERE id=? AND owner_key=?").bind(new Date().toISOString(), id, owner.key).run();
      throw new ApiError(410, "This payment request has expired.");
    }
    const svg = await QRCode.toString(String(paymentRequest.upi_uri), { type: "svg", width: 320, margin: 2, color: { dark: "#171d31", light: "#ffffff" }, errorCorrectionLevel: "M" });
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return jsonError(error); }
}
