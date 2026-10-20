// Ícone girando para mostrar que a IA está trabalhando.
export function Girando({ texto }: { texto: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2" role="status">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      {texto}
    </span>
  );
}
