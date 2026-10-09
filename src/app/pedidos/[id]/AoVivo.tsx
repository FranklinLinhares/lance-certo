"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/navegador";

// Recarrega a página quando chega um lance novo ou o pedido muda.
export function AoVivo({ pedido }: { pedido: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = criarClienteNavegador();
    const canal = supabase
      .channel(`pedido-${pedido}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lances", filter: `pedido_id=eq.${pedido}` }, () => router.refresh())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${pedido}` }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [pedido, router]);
  return null;
}
