import { redirect } from "next/navigation";

// Legacy /auth route — redirect to new pages
export default function AuthRedirect() {
  redirect("/login");
}
