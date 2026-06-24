// FIXED v4: src/app/(auth)/register/page.tsx
// Root cause: Next.js SSR hydration was re-mounting the component and wiping state.
// Fix: disable SSR on the client component entirely with dynamic() + ssr:false
// This stops the hydration mismatch and keeps React state stable across renders.
"use client";
import dynamic from "next/dynamic";

const RegisterForm = dynamic(() => import("./_register-form"), { ssr: false });

export default function RegisterPage() {
  return <RegisterForm />;
}
