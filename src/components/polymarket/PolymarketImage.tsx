import { useState } from "react";

/** Use the source site's thumbnail service only for its public image bucket. */
export function polymarketThumbnail(src: string, size = 96): string {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" || url.hostname !== "polymarket-upload.s3.us-east-2.amazonaws.com") return src;
    const thumbnail = new URL("https://polymarket.com/_next/image");
    thumbnail.searchParams.set("url", url.toString());
    thumbnail.searchParams.set("w", String(size <= 96 ? 96 : 256));
    thumbnail.searchParams.set("q", "75");
    return thumbnail.toString();
  } catch { return src; }
}

export function PolymarketImage({ src, className, eager = false }: { src: string; className?: string; eager?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const thumbnail = polymarketThumbnail(src);
  return <img src={failedSrc === src ? src : thumbnail} alt="" width={96} height={96} loading={eager ? "eager" : "lazy"} decoding="async" className={className} onError={() => { if (thumbnail !== src) setFailedSrc(src); }} />;
}
