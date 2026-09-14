import { AuthLanding } from "../auth-landing";
import { getChatGPTUser } from "../chatgpt-auth";
import RentFlowApp from "../rentflow-client";

export const dynamic = "force-dynamic";
export default async function ListRoute() {
  const user = await getChatGPTUser();
  if (!user) return <AuthLanding mode="login" />;
  return <RentFlowApp ownerName={user.fullName ?? user.email} ownerEmail={user.email} initialPage="properties" />;
}
