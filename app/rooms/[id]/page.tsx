import { AuthLanding } from "../../auth-landing";
import { getChatGPTUser } from "../../chatgpt-auth";
import EntityDetail from "../../entity-detail-client";

export const dynamic = "force-dynamic";

export default async function DetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return <AuthLanding mode="login" />;
  const { id } = await params;
  return <EntityDetail kind="room" id={id} />;
}
