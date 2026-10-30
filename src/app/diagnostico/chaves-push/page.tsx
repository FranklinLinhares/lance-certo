"use client";

import { useState } from "react";

type Chaves = { publica: string; privada: string; segredo: string };

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const texto = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(texto).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Gera, no próprio navegador, as chaves dos avisos no celular. Nada sai deste aparelho:
// quem configura copia os valores para a Vercel e para o Vault do Supabase.
async function gerar(): Promise<Chaves> {
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publica = base64url(await crypto.subtle.exportKey("raw", par.publicKey));
  const { d } = await crypto.subtle.exportKey("jwk", par.privateKey);
  return { publica, privada: d!, segredo: base64url(crypto.getRandomValues(new Uint8Array(24))) };
}

function Campo({ nome, valor }: { nome: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <code className="text-sm font-semibold">{nome}</code>
        <button
          type="button"
          className="botao-secundario py-1 text-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(valor);
            setCopiado(true);
          }}
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="rounded-lg bg-stone-100 p-2 font-mono text-xs break-all">{valor}</p>
    </div>
  );
}

export default function ChavesPush() {
  const [chaves, setChaves] = useState<Chaves | null>(null);
  const url = typeof window === "undefined" ? "" : `${location.origin}/api/push`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Chaves dos avisos no celular</h1>
      <p className="text-stone-600">
        Gere uma vez, copie para a Vercel e para o Supabase e não compartilhe. Se gerar de novo, troque tudo e cada pessoa precisa ativar os avisos outra vez.
      </p>
      <button type="button" className="botao" onClick={async () => setChaves(await gerar())}>
        Gerar chaves
      </button>
      {chaves && (
        <>
          <section className="cartao space-y-3">
            <h2 className="font-semibold">1. Na Vercel (Settings → Environment Variables), depois Redeploy</h2>
            <Campo nome="NEXT_PUBLIC_VAPID_PUBLIC_KEY" valor={chaves.publica} />
            <Campo nome="VAPID_PRIVATE_KEY" valor={chaves.privada} />
            <Campo nome="PUSH_SEGREDO" valor={chaves.segredo} />
          </section>
          <section className="cartao space-y-3">
            <h2 className="font-semibold">2. No SQL Editor do Supabase (depois da migração 0022)</h2>
            <Campo
              nome="SQL"
              valor={`select vault.create_secret('${url}', 'lance_certo_push_url');\nselect vault.create_secret('${chaves.segredo}', 'lance_certo_push_segredo');`}
            />
          </section>
        </>
      )}
    </div>
  );
}
