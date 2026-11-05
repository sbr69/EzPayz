import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Dialog";
import { CopyField } from "@/components/ui/display";
import { downloadText } from "@/lib/money";

export function QRCodeImage({
  value,
  size = 160,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      margin: 1,
      width: size * 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1b1f1e", light: "#ffffff" },
    })
      .then((u) => {
        if (active) setUrl(u);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded border border-line bg-canvas text-[11.5px] text-ink-4"
        style={{ width: size, height: size }}
      >
        QR unavailable
      </div>
    );
  }
  if (!url) {
    return <div className="animate-pulse rounded bg-canvas-alt" style={{ width: size, height: size }} />;
  }
  return <img src={url} alt="QR code linking to the hosted checkout page" className={className} width={size} height={size} />;
}

export function QRCodeDialog({
  open,
  onClose,
  url,
  title,
  description,
  merchantName,
  amountLabel,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  description?: string;
  merchantName: string;
  amountLabel?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { margin: 2, width: 720, errorCorrectionLevel: "M", color: { dark: "#1b1f1e", light: "#ffffff" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [open, url]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-qr.png`;
    a.click();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Scan to pay"
      description="The QR code encodes the hosted checkout URL — never a raw token transfer instruction."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={download} disabled={!dataUrl}>
            Download PNG
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-canvas p-5">
          <QRCodeImage value={url} size={200} />
          <div className="text-center">
            <p className="text-[13px] font-semibold text-ink">{merchantName}</p>
            <p className="text-[12.5px] text-ink-2">{title}</p>
            {amountLabel ? <p className="text-[12.5px] font-semibold text-ink tnum">{amountLabel}</p> : null}
            {description ? <p className="mt-1 max-w-xs text-[11.5px] text-ink-4">{description}</p> : null}
          </div>
        </div>
        <CopyField label="Checkout URL" value={url} />
        <button
          onClick={() => downloadText(`${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-url.txt`, url)}
          className="text-[12px] font-medium text-accent hover:underline"
        >
          Download URL as text file
        </button>
        <p className="text-[11.5px] leading-relaxed text-ink-4">
          Scanning opens the hosted checkout page in a wallet browser. The customer still reviews the
          amount and recipient and signs the payment authorization themselves.
        </p>
      </div>
    </Modal>
  );
}
