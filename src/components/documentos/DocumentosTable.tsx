import { Eye, Pencil, Trash2, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ApiRndcDocumento } from "@/services/apirndc/apirndc.types";

function getEstadoBadgeClasses(estado: string): string {
  switch (estado) {
    case "VIGENTE":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800";
    case "POR_VENCER":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
    case "VENCIDO":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
    case "HISTORICO":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700";
    case "RECHAZADO":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400";
  }
}

/** Double validation: trust backend estado, but override if fechaVencimiento contradicts */
function computeEstado(doc: ApiRndcDocumento): string {
  const backendEstado = doc.estado || "VIGENTE";
  if (!doc.fechaVencimiento) return backendEstado;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const venc = new Date(doc.fechaVencimiento);
  venc.setHours(0, 0, 0, 0);
  if (venc < now) return "VENCIDO";
  const diff = (venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 30 && backendEstado !== "VENCIDO") return "POR_VENCER";
  return backendEstado;
}

function formatDate(date?: string) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

function getEntidadLabel(doc: ApiRndcDocumento): string {
  const eid = doc.entidadId;
  if (!eid) return "-";
  if (typeof eid === "string") return eid;
  // Populated object
  const obj = eid as Record<string, unknown>;
  if (obj.placa) return String(obj.placa);
  if (obj.razonSocial) return String(obj.razonSocial);
  if (obj.nombres) return `${obj.nombres} ${obj.apellidos ?? ""}`.trim();
  if (obj.identificacion) return String(obj.identificacion);
  return obj._id ? String(obj._id) : "-";
}

interface DocumentosTableProps {
  documentos: ApiRndcDocumento[];
  pagination?: { page: number; limit: number; total: number; pages: number };
  onPageChange: (page: number) => void;
  onView: (doc: ApiRndcDocumento) => void;
  onEdit: (doc: ApiRndcDocumento) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}

export function DocumentosTable({
  documentos,
  pagination,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  isAdmin,
}: DocumentosTableProps) {
  if (documentos.length === 0) {
    return (
      <div className="text-center py-12 bg-card border rounded-lg">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No se encontraron documentos</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo Documento</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Numero</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Expedicion</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentos.map((doc) => (
              <TableRow key={doc._id}>
                <TableCell className="font-medium">
                  {doc.tipoDocumento?.replace(/_/g, " ") || "-"}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium">{getEntidadLabel(doc)}</p>
                    <Badge variant="outline" className="text-xs mt-0.5">
                      {doc.entidadModelo}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>{doc.numero || "-"}</TableCell>
                <TableCell>
                  {(() => {
                    const estado = computeEstado(doc);
                    return (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getEstadoBadgeClasses(estado)}`}>
                        {estado.replace(/_/g, " ")}
                      </span>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(doc.fechaExpedicion)}
                </TableCell>
                <TableCell className="text-sm">
                  {(() => {
                    const estado = computeEstado(doc);
                    const colorClass = estado === "VENCIDO"
                      ? "text-red-600 dark:text-red-400 font-semibold"
                      : estado === "POR_VENCER"
                      ? "text-amber-600 dark:text-amber-400 font-medium"
                      : "text-muted-foreground";
                    return <span className={colorClass}>{formatDate(doc.fechaVencimiento)}</span>;
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onView(doc)} title="Ver detalle">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(doc)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Eliminar">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar documento</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta accion enviara el documento a la papelera. Podra restaurarlo posteriormente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(doc._id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {documentos.length} de {pagination.total} documentos
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Pagina {pagination.page} de {pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
