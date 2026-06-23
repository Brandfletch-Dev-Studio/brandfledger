// UPDATED: src/app/onboarding/page.tsx
// Onboarding is gone as a standalone page — redirect to dashboard which has the checklist

import { redirect } from "next/navigation";

export default function OnboardingPage() {
  redirect("/dashboard");
}
