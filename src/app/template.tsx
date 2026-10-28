// Cada página entra com um leve deslizar, para a troca de tela não ser seca.
export default function Transicao({ children }: { children: React.ReactNode }) {
  return <div className="animate-surgir">{children}</div>;
}
