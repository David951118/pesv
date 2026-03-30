import { useRef, useState } from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download, QrCode, CheckCircle, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type QRTipo = "preoperacional" | "contrato";

interface QRShareModalProps {
  open: boolean;
  onClose: () => void;
  codigoPublico: string;
  placa?: string;
  fecha?: string;
  /** "preoperacional" (default) or "contrato" */
  tipo?: QRTipo;
  /** Extra label for contrato, e.g. N° FUEC */
  label?: string;
}

const TITLES: Record<QRTipo, string> = {
  preoperacional: "Compartir Preoperacional",
  contrato: "Compartir Contrato FUEC",
};

const ICONS: Record<QRTipo, typeof QrCode> = {
  preoperacional: ShieldCheck,
  contrato: FileText,
};

const PATHS: Record<QRTipo, string> = {
  preoperacional: "/verificar/preoperacional/",
  contrato: "/verificar/contrato/",
};

export function QRShareModal({ open, onClose, codigoPublico, placa, fecha, tipo = "preoperacional", label }: QRShareModalProps) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const url = `${window.location.origin}${PATHS[tipo]}${codigoPublico}`;
  const Icon = ICONS[tipo];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Enlace copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) {
      toast.error("Error al generar imagen QR");
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${tipo}-qr-${codigoPublico}.png`;
    a.click();
    toast.success("QR descargado");
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-sm w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {TITLES[tipo]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {(placa || fecha || label) && (
            <div className="text-center text-sm text-muted-foreground space-y-0.5">
              {label && <p className="font-semibold text-foreground">{label}</p>}
              <p>
                {placa && <span className="font-semibold text-foreground">{placa}</span>}
                {placa && fecha && " · "}
                {fecha && <span>{fecha}</span>}
              </p>
            </div>
          )}

          {/* Visible QR (SVG for display) */}
          <div className="flex justify-center p-4 bg-white rounded-xl border">
            <QRCodeSVG
              value={url}
              size={200}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
            />
          </div>

          {/* Hidden canvas for download */}
          <div ref={canvasRef} className="hidden">
            <QRCodeCanvas
              value={url}
              size={400}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
            />
          </div>

          {/* URL display */}
          <div className="text-xs text-muted-foreground text-center break-all px-2 bg-muted/50 rounded-md py-2 font-mono">
            {url}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
              {copied ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copiado" : "Copiar enlace"}
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Descargar QR
            </Button>
          </div>

          <Button className="w-full" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
