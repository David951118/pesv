import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Check, Loader2, PenLine } from "lucide-react";

interface SignaturePadProps {
  onSignatureReady: (blob: Blob) => void;
  disabled?: boolean;
  uploading?: boolean;
  signed?: boolean;
}

export function SignaturePad({ onSignatureReady, disabled = false, uploading, signed }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || signed) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled || signed) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
  };

  const confirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    canvas.toBlob((blob) => {
      if (blob) onSignatureReady(blob);
    }, "image/png");
  };

  if (signed) {
    return (
      <div className="bg-card border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <PenLine className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Firma del Conductor</h3>
        </div>
        <div className="flex items-center justify-center gap-2 py-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <Check className="h-5 w-5 text-green-600" />
          <span className="font-medium text-green-700 dark:text-green-400">Firma capturada y subida</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <PenLine className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Firma del Conductor</h3>
      </div>

      <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-white dark:bg-gray-950 touch-none">
        <canvas
          ref={canvasRef}
          className="w-full h-40 cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      {!hasSignature && (
        <p className="text-xs text-muted-foreground text-center">Dibuje su firma con el dedo o mouse</p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearSignature}
          disabled={disabled || !hasSignature || uploading}
          className="gap-1.5 flex-1"
        >
          <Eraser className="h-3.5 w-3.5" />
          Borrar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={confirmSignature}
          disabled={disabled || !hasSignature || uploading}
          className="gap-1.5 flex-1"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {uploading ? "Subiendo..." : "Confirmar Firma"}
        </Button>
      </div>
    </div>
  );
}
