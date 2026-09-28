import * as React from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrCode({ value, size = 180, className }: QrCodeProps) {
  const [dataUrl, setDataUrl] = React.useState<string>("");

  React.useEffect(() => {
    let active = true;
    const render = async () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = 2;
        await QRCode.toCanvas(canvas, value, {
          width: size * scale,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const c = canvas.width / 2;
          const box = canvas.width * 0.26;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(c - box / 2, c - box / 2, box, box);
          ctx.fillStyle = "#a3e635";
          const r = box * 0.2;
          const x = c - box / 2 + box * 0.08;
          const y = c - box / 2 + box * 0.08;
          const w = box * 0.84;
          ctx.beginPath();
          ctx.roundRect(x, y, w, w, r);
          ctx.fill();

          // Lumen mark: two open light rings around a bright core.
          ctx.strokeStyle = "#003825";
          ctx.lineWidth = box * 0.075;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.arc(c, c, box * 0.27, Math.PI * 0.2, Math.PI * 1.85);
          ctx.stroke();
          ctx.globalAlpha = 0.62;
          ctx.beginPath();
          ctx.arc(c, c, box * 0.15, Math.PI * 0.2, Math.PI * 1.85);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#003825";
          ctx.beginPath();
          ctx.arc(c, c, box * 0.045, 0, Math.PI * 2);
          ctx.fill();
        }
        if (active) setDataUrl(canvas.toDataURL("image/png"));
      } catch {
        if (active) setDataUrl("");
      }
    };
    void render();
    return () => {
      active = false;
    };
  }, [value, size]);

  return (
    <div
      className={cn(
        "grid place-items-center rounded-base border-2 border-border bg-white p-2 neo-shadow",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {dataUrl ? (
        <img src={dataUrl} alt="QR code" className="h-full w-full" />
      ) : (
        <div className="h-full w-full animate-pulse bg-zinc-200" />
      )}
    </div>
  );
}
