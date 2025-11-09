"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { onAuthChange } from "@/lib/hooks/useAuth";
import FungoUniverse from "@/components/FungoUniverse";

export default function FungoUniversePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((authUser) => {
      if (!authUser) {
        router.push("/login");
      } else {
        setUser(authUser);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <main className="min-h-screen w-screen overflow-hidden bg-black text-white">
      <div className="absolute top-4 left-4 z-50">
        <button
          onClick={() => router.push("/")}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors backdrop-blur-sm border border-white/20"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="w-full h-screen">
        <FungoUniverse />
      </div>
    </main>
  );
}

