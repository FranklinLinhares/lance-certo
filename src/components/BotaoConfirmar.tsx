"use client";

// Botão de formulário que pergunta antes de enviar, para ações que não têm volta.
export function BotaoConfirmar({
  pergunta,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pergunta: string }) {
  return (
    <button
      {...props}
      onClick={(e) => {
        if (!confirm(pergunta)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
