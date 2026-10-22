// Prepara o folheto no navegador: fotos e páginas de PDF viram JPEG pequenos,
// para o envio caber no limite da Vercel (4,5 MB por requisição).

const LADO_MAXIMO = 1800; // px: ainda legível para a IA
export const MAXIMO_PAGINAS = 6;
// Limite do corpo enviado (o base64 já é ~33% maior que o arquivo).
export const MAXIMO_ENVIO = 4_000_000;

function paraJpeg(origem: CanvasImageSource, largura: number, altura: number, qualidade: number) {
  const escala = Math.min(1, LADO_MAXIMO / Math.max(largura, altura));
  const tela = document.createElement("canvas");
  tela.width = Math.round(largura * escala);
  tela.height = Math.round(altura * escala);
  const ctx = tela.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, tela.width, tela.height);
  ctx.drawImage(origem, 0, 0, tela.width, tela.height);
  return tela.toDataURL("image/jpeg", qualidade).split(",")[1];
}

export async function fotoParaJpeg(arquivo: File, qualidade = 0.8) {
  const imagem = await createImageBitmap(arquivo);
  return paraJpeg(imagem, imagem.width, imagem.height, qualidade);
}

// Cada página do PDF vira uma imagem, até `limite` páginas.
export async function pdfParaJpegs(arquivo: File, limite: number, qualidade = 0.8) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()), isEvalSupported: false }).promise;
  const paginas: string[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, limite); n++) {
    const pagina = await pdf.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: LADO_MAXIMO / Math.max(base.width, base.height) });
    const tela = document.createElement("canvas");
    tela.width = Math.round(viewport.width);
    tela.height = Math.round(viewport.height);
    await pagina.render({ canvasContext: tela.getContext("2d")!, viewport }).promise;
    paginas.push(paraJpeg(tela, tela.width, tela.height, qualidade));
  }
  return { paginas, total: pdf.numPages };
}
