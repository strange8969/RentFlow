import { redirect } from "next/navigation";
import { AuthLanding } from "../auth-landing";
import { getChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getChatGPTUser()) redirect("/");
  return <AuthLanding mode="login" />;
}
