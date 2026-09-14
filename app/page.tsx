import { AuthLanding } from "./auth-landing";
import { getChatGPTUser } from "./chatgpt-auth";
import RentFlowApp from "./rentflow-client";

export const dynamic = "force-dynamic";

const validPages = new Set(["dashboard", "operations", "properties", "rooms", "tenants", "rent", "electricity", "payments", "expenses", "maintenance", "reports", "documents", "settings"]);

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getChatGPTUser();
  if (!user) return <AuthLanding />;
  const query = await searchParams;
  const requested = typeof query.page === "string" && validPages.has(query.page) ? query.page : "dashboard";
  return <RentFlowApp ownerName={user.fullName ?? user.email} ownerEmail={user.email} initialPage={requested as any} />;
}
