import { useEffect, useRef, useState } from "react";
import { Copy, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PaperPurchaseShare } from "@/lib/paperPurchaseShare";

async function imageAsDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: "cors", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export function PaperTradeShareDialog({ purchase, onClose }: { purchase: PaperPurchaseShare | null; onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [previewImageFailed, setPreviewImageFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!purchase) return;
    let cancelled = false;
    setImage(null); setImageFailed(false); setPreviewImageFailed(false);
    async function prepare() {
      try {
        const safeImage = await imageAsDataUrl(purchase!.imageUrl);
        const { default: html2canvas } = await import("html2canvas");
        if (cancelled || !card.current) return;
        const width = card.current.getBoundingClientRect().width;
        if (!width) throw new Error("Card indisponível");
        const canvas = await html2canvas(card.current, {
          backgroundColor: "#080d1b", scale: 1080 / width, useCORS: true,
          onclone: (doc) => {
            const photo = doc.querySelector<HTMLImageElement>('[data-paper-share-image]');
            const fallback = doc.querySelector<HTMLElement>('[data-paper-share-fallback]');
            if (photo && safeImage) photo.src = safeImage;
            else { if (photo) photo.style.display = "none"; if (fallback) fallback.style.display = "flex"; }
          },
        });
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("Não foi possível gerar a imagem");
        if (!cancelled) setImage(new File([blob], "minha-previsao.png", { type: "image/png" }));
      } catch { if (!cancelled) setImageFailed(true); }
    }
    void prepare();
    return () => { cancelled = true; };
  }, [purchase, attempt]);

  if (!purchase) return null;
  const negative = /^(no|não|nao)$/i.test(purchase.outcome.trim());
  const outcome = /^(yes|sim)$/i.test(purchase.outcome.trim()) ? "SIM" : negative ? "NÃO" : purchase.outcome;
  const canShare = Boolean(image && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [image] }));
  const link = typeof window === "undefined" ? "" : new URL(`/polymarket/market/${encodeURIComponent(purchase.marketId)}`, window.location.origin).toString();

  async function share() {
    if (!image) return;
    try { await navigator.share({ files: [image], title: "Minha previsão simulada" }); }
    catch (error) { if (!(error instanceof Error && error.name === "AbortError")) toast.error("Não foi possível compartilhar. Baixe a imagem para tentar novamente."); }
  }
  function download() {
    if (!image) return;
    const url = URL.createObjectURL(image);
    const anchor = document.createElement("a");
    try { anchor.href = url; anchor.download = image.name; document.body.appendChild(anchor); anchor.click(); }
    finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); toast.success("Link do mercado copiado."); }
    catch { toast.error("Não foi possível copiar o link."); }
  }

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[95dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>Compartilhar minha previsão</DialogTitle><DialogDescription>Compra simulada confirmada. Escolha se deseja compartilhar.</DialogDescription></DialogHeader>
      <div ref={card} className="mx-auto flex aspect-[9/16] w-full max-w-[300px] flex-col overflow-hidden rounded-2xl p-6 text-white" style={{ background: negative ? "linear-gradient(150deg,#101b36 0%,#251127 60%,#4a1524 100%)" : "linear-gradient(150deg,#101b36 0%,#10283a 60%,#104438 100%)", fontFamily: "Arial, sans-serif" }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: "#8edbff" }}>PREDICTMARKET</div>
        <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, color: "#c3d3e3", textTransform: "uppercase" }}>Compra simulada · Paper Trading</div>
        <div style={{ marginTop: "auto" }}>
          {purchase.imageUrl && !previewImageFailed && <img data-paper-share-image src={purchase.imageUrl} onError={() => setPreviewImageFailed(true)} alt="" crossOrigin="anonymous" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 14, marginBottom: 18 }} />}
          <div data-paper-share-fallback style={{ display: purchase.imageUrl && !previewImageFailed ? "none" : "flex", width: 60, height: 60, borderRadius: 14, background: "#244558", alignItems: "center", justifyContent: "center", marginBottom: 18, fontSize: 28 }}>✦</div>
          <div style={{ color: "#9db5c8", fontSize: 13, fontWeight: 700 }}>MINHA PREVISÃO</div>
          <div style={{ marginTop: 10, fontSize: 23, fontWeight: 700, lineHeight: 1.18, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{purchase.question}</div>
          <div style={{ display: "inline-block", marginTop: 18, padding: "8px 16px", borderRadius: 10, color: negative ? "#ffb9c6" : "#8ef4c3", background: negative ? "#682639" : "#176548", fontSize: 18, fontWeight: 700 }}>{outcome}</div>
          <div style={{ display: "flex", gap: 28, marginTop: 25 }}>
            <div><div style={{ fontSize: 11, color: "#b5c7d4" }}>SHARES</div><div style={{ fontSize: 21, fontWeight: 700 }}>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(purchase.shares)}</div></div>
            <div><div style={{ fontSize: 11, color: "#b5c7d4" }}>PREÇO DA COMPRA</div><div style={{ fontSize: 21, fontWeight: 700 }}>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(purchase.price * 100)}¢</div></div>
          </div>
        </div>
        <div style={{ marginTop: "auto", paddingTop: 20, fontSize: 11, color: "#b5c7d4" }}>Dados de mercado: Polymarket · Nenhuma ordem real</div>
      </div>
      {imageFailed && <div role="alert" className="text-center text-sm text-destructive">Não foi possível gerar a imagem. <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div>}
      <div className="flex flex-wrap justify-center gap-2">
        {canShare && <Button onClick={share}><Share2 className="mr-2 h-4 w-4" />Compartilhar imagem</Button>}
        <Button variant="outline" disabled={!image} onClick={download}><Download className="mr-2 h-4 w-4" />{!image && !imageFailed ? "Preparando imagem..." : "Baixar PNG"}</Button>
        <Button variant="outline" onClick={copyLink}><Copy className="mr-2 h-4 w-4" />Copiar link</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
