import { useRef, useState, useCallback } from "react";
import { Upload, File as FileIcon, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPT_STRING = ACCEPTED_TYPES.join(",");

interface FileDropZoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  uploadProgress: number | null;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropZone({ file, onFileChange, uploadProgress, disabled }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const validateAndSet = useCallback((f: File) => {
    if (f.size > MAX_SIZE) {
      toast.error(`El archivo excede 10MB (${formatBytes(f.size)})`);
      return;
    }
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error("Tipo de archivo no soportado. Use PDF, imagen o Word.");
      return;
    }
    onFileChange(f);
  }, [onFileChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) validateAndSet(f);
  }, [disabled, validateAndSet]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSet(f);
    if (inputRef.current) inputRef.current.value = "";
  }, [validateAndSet]);

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const isUploading = uploadProgress !== null && uploadProgress < 100;

  if (file) {
    return (
      <div className="border border-border rounded-lg p-3 space-y-2 overflow-hidden">
        <div className="flex items-center gap-3 min-w-0">
          <FileIcon className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-sm font-medium truncate max-w-full">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          {!isUploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onFileChange(null)}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {uploadProgress !== null && (
          <div className="space-y-1">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">{uploadProgress}%</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_STRING}
        className="hidden"
        onChange={handleInputChange}
      />
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Arrastre un archivo aqui o <span className="text-primary font-medium">click para seleccionar</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">PDF, imagenes o Word. Max 10MB</p>
      </div>
    </>
  );
}
