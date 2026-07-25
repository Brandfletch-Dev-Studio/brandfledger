"use client";
import { useEffect, useState } from "react";
import { BFLogo } from "@/components/bf-logo";

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFadeOut(true), 1400);
    const t2 = setTimeout(() => setVisible(false), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      style={{ backgroundColor: "#3730a3" }}
    >
      <div className="flex flex-col items-center gap-5">
        <BFLogo size={96} className="rounded-3xl shadow-2xl" />
        <div className="text-center">
          <p className="text-white text-2xl font-bold tracking-tight">Brandfledger</p>
          <p className="text-indigo-300 text-sm mt-1">Your business, under control</p>
        </div>
      </div>

      <div className="absolute bottom-16 flex gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-white/40"
            style={{ animation: `bfpulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>

      <style>{`
        @keyframes bfpulse {
          0%,80%,100% { opacity:0.3; transform:scale(0.8); }
          40% { opacity:1; transform:scale(1); }
        }
      `}</style>
    </div>
  );
}
