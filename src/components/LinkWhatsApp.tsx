// Abre a conversa no WhatsApp em outra aba, para a pessoa não sair do app.
export function LinkWhatsApp({ telefone, children = "WhatsApp", className = "underline" }: { telefone: string | null | undefined; children?: React.ReactNode; className?: string }) {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  const numero = digitos.startsWith("55") && digitos.length >= 12 ? digitos : `55${digitos}`;
  return (
    <a href={`https://wa.me/${numero}`} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
