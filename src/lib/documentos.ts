// Validação de CNPJ e CPF pelos dígitos verificadores.

export function soDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

function digito(numeros: string, pesos: number[]) {
  const soma = pesos.reduce((total, peso, i) => total + Number(numeros[i]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(valor: string) {
  const cnpj = soDigitos(valor);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const d1 = digito(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${d1}${d2}`);
}

export function cpfValido(valor: string) {
  const cpf = soDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const d1 = digito(cpf, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(cpf, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cpf.endsWith(`${d1}${d2}`);
}

// Enquanto o app está em testes, CNPJ/CPF não é exigido nem conferido.
// Para voltar a exigir, crie na Vercel a variável NEXT_PUBLIC_EXIGIR_DOCUMENTO=sim e faça Redeploy.
export const EXIGIR_DOCUMENTO = process.env.NEXT_PUBLIC_EXIGIR_DOCUMENTO === "sim";

// Número de CPF (11) ou CNPJ (14) para quem testa sem documento. Começa com 000 para ser fácil de achar e apagar depois.
export function documentoDeTeste(tamanho: 11 | 14) {
  const aleatorio = Array.from(crypto.getRandomValues(new Uint8Array(tamanho - 3)), (n) => n % 10).join("");
  return `000${aleatorio}`;
}
