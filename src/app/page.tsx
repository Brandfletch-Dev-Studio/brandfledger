import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LandingClient from "./_landing-client";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  return <LandingClient />;
}
