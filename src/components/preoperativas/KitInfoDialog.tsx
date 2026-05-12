import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MinusCircle, XCircle, ShieldCheck, AlertTriangle, Briefcase, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";

export type EstadoKit = "BUENO" | "REGULAR" | "MALO" | "NO_APLICA";

const ESTADO_META: Record<EstadoKit, { label: string; tone: string; icon: any; description: string }> = {
  BUENO: {
    label: "BUENO",
    tone: "text-green-700 bg-green-50 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800",
    icon: CheckCircle2,
    description: "completo, en buen estado y vigente",
  },
  REGULAR: {
    label: "REGULAR",
    tone: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
    icon: MinusCircle,
    description: "con algunos elementos en estado limitado o por reponer",
  },
  MALO: {
    label: "MALO",
    tone: "text-red-700 bg-red-50 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
    icon: XCircle,
    description: "incompleto, vencido o no apto para uso",
  },
  NO_APLICA: {
    label: "NO APLICA",
    tone: "text-slate-700 bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700",
    icon: AlertTriangle,
    description: "el vehiculo no requiere este elemento",
  },
};

interface KitInfoDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  estado: EstadoKit;
  // Tipo del kit decide titulo, items y color del header
  kit: "primerosAuxilios" | "carretera";
  items: readonly string[];
  // Cuando el conductor confirma "si los tengo": se cierra y mantiene el estado seleccionado.
  onConfirm: () => void;
}

const KIT_META: Record<KitInfoDialogProps["kit"], { titulo: string; icono: any; intro: string }> = {
  primerosAuxilios: {
    titulo: "Kit de Primeros Auxilios",
    icono: HeartPulse,
    intro: "Tu kit de primeros auxilios debe contener al menos los siguientes elementos en estado",
  },
  carretera: {
    titulo: "Equipo de Carretera",
    icono: Briefcase,
    intro: "Tu equipo de carretera debe contener al menos los siguientes elementos en estado",
  },
};

export function KitInfoDialog({ open, onOpenChange, estado, kit, items, onConfirm }: KitInfoDialogProps) {
  const meta = KIT_META[kit];
  const estadoMeta = ESTADO_META[estado];
  const Icon = meta.icono;
  const EstadoIcon = estadoMeta.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Icon className="h-5 w-5 text-primary shrink-0" />
            {meta.titulo}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Confirmacion de estado del {meta.titulo.toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm space-y-2">
          <p>
            Estas seleccionando el estado{" "}
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold", estadoMeta.tone)}>
              <EstadoIcon className="h-3 w-3" />
              {estadoMeta.label}
            </span>
          </p>
          <p className="text-muted-foreground">
            {meta.intro} <span className="font-semibold text-foreground">{estadoMeta.description}</span>:
          </p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 py-2">
          {items.map((it) => (
            <li key={it} className="flex items-start gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span className="text-foreground">{it}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-md bg-muted/40 border p-3 text-xs text-muted-foreground">
          Si te falta alguno de estos elementos, marca <strong>REGULAR</strong> o <strong>MALO</strong> y agrega
          una observacion indicando que falta.
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Si, lo tengo asi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
