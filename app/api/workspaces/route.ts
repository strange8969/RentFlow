import { database, jsonError, requireOwner, rows, str } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const owner = await requireOwner();
    const memberships = await rows<Record<string, unknown>>(database().prepare("SELECT wm.workspace_id, wm.role, w.name FROM workspace_memberships wm JOIN workspaces w ON w.id=wm.workspace_id WHERE wm.user_id=? AND wm.status='active' AND w.status='active' ORDER BY w.name COLLATE NOCASE").bind(owner.userKey));
    return Response.json({ activeWorkspaceId: owner.key, memberships });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const owner = await requireOwner();
    const body = await request.json() as Record<string, unknown>;
    const workspaceId = str(body.workspaceId, "Workspace", true);
    const membership = await database().prepare("SELECT id FROM workspace_memberships WHERE user_id=? AND workspace_id=? AND status='active'").bind(owner.userKey, workspaceId).first();
    if (!membership) return Response.json({ error: "You do not have access to that workspace." }, { status: 403 });
    return new Response(JSON.stringify({ ok: true, workspaceId }), { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": `rentflow_workspace=${encodeURIComponent(workspaceId)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000` } });
  } catch (error) { return jsonError(error); }
}
