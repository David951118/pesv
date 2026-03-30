import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileDown, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  Bus, 
  User, 
  FileText,
  Building
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCoopsetrans from "@/assets/logo-coopsetrans.png";

interface DocumentoProblema {
  nombre: string;
  estado: "vencido" | "pendiente" | "por_vencer" | "vigente";
  fechaVencimiento?: string;
  mensaje: string;
  responsable?: string;
  notaNA?: string;
  aplica?: boolean;
}

interface FUECRechazoReportProps {
  vehiculo: {
    placa: string;
    marca?: string | null;
    linea?: string | null;
    interno?: string | null;
  };
  conductor: {
    nombre: string;
    licencia: string;
  };
  contrato: {
    cliente: string;
    ruta: string;
    tipo_servicio: string;
  };
  fechaIntento: Date;
  documentosVencidos: DocumentoProblema[];
  documentosFaltantes: DocumentoProblema[];
  documentosPorVencer: DocumentoProblema[];
  onClose: () => void;
}

export function FUECRechazoReport({
  vehiculo,
  conductor,
  contrato,
  fechaIntento,
  documentosVencidos,
  documentosFaltantes,
  documentosPorVencer,
  onClose,
}: FUECRechazoReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  const exportarPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Logo arriba a la derecha
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const logoBase64 = await new Promise<string>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.getContext("2d")?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = logoCoopsetrans;
      });
      doc.addImage(logoBase64, "PNG", pageWidth - margin - 50, 10, 50, 18);
    } catch { /* continue without logo */ }

    // Encabezado
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE DE RECHAZO DE FUEC", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha del intento: ${format(fechaIntento, "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}`, pageWidth / 2, 28, { align: "center" });
    
    // Línea separadora
    doc.setLineWidth(0.5);
    doc.line(14, 32, pageWidth - 14, 32);
    
    let yPos = 40;
    
    // Información del vehículo
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("INFORMACIÓN DEL VEHÍCULO", 14, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Placa: ${vehiculo.placa}`, 14, yPos);
    doc.text(`Interno: ${vehiculo.interno || "N/A"}`, 100, yPos);
    yPos += 6;
    doc.text(`Marca/Línea: ${vehiculo.marca || ""} ${vehiculo.linea || ""}`, 14, yPos);
    yPos += 10;
    
    // Información del conductor
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("INFORMACIÓN DEL CONDUCTOR", 14, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Nombre: ${conductor.nombre}`, 14, yPos);
    yPos += 6;
    doc.text(`No. Licencia: ${conductor.licencia}`, 14, yPos);
    yPos += 10;
    
    // Información del contrato
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("INFORMACIÓN DEL CONTRATO", 14, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Cliente: ${contrato.cliente}`, 14, yPos);
    yPos += 6;
    doc.text(`Tipo de Servicio: ${contrato.tipo_servicio}`, 14, yPos);
    yPos += 6;
    doc.text(`Ruta: ${contrato.ruta}`, 14, yPos);
    yPos += 12;
    
    // Documentos vencidos
    if (documentosVencidos.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 53, 69);
      doc.text("DOCUMENTOS VENCIDOS (Bloquean emisión)", 14, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 4;
      
      autoTable(doc, {
        startY: yPos,
        head: [["Documento", "Fecha Vencimiento", "Responsable", "Observación"]],
        body: documentosVencidos.map(d => [
          d.nombre,
          d.fechaVencimiento ? format(new Date(d.fechaVencimiento), "dd/MM/yyyy") : "Sin fecha",
          d.responsable || "No asignado",
          d.mensaje,
        ]),
        theme: "striped",
        headStyles: { fillColor: [220, 53, 69] },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Documentos faltantes
    if (documentosFaltantes.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(108, 117, 125);
      doc.text("DOCUMENTOS FALTANTES O N/A", 14, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 4;
      
      autoTable(doc, {
        startY: yPos,
        head: [["Documento", "Estado", "Nota/Justificación"]],
        body: documentosFaltantes.map(d => [
          d.nombre,
          d.notaNA ? "N/A" : "Sin información",
          d.notaNA || d.mensaje,
        ]),
        theme: "striped",
        headStyles: { fillColor: [108, 117, 125] },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Documentos por vencer (advertencia)
    if (documentosPorVencer.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 193, 7);
      doc.text("DOCUMENTOS PRÓXIMOS A VENCER (Advertencia)", 14, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 4;
      
      autoTable(doc, {
        startY: yPos,
        head: [["Documento", "Fecha Vencimiento", "Días Restantes"]],
        body: documentosPorVencer.map(d => [
          d.nombre,
          d.fechaVencimiento ? format(new Date(d.fechaVencimiento), "dd/MM/yyyy") : "Sin fecha",
          d.mensaje,
        ]),
        theme: "striped",
        headStyles: { fillColor: [255, 193, 7], textColor: [0, 0, 0] },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Pie de página
    const totalProblemas = documentosVencidos.length + documentosFaltantes.length;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`RESULTADO: FUEC NO EMITIDO - ${totalProblemas} documento(s) con problemas`, 14, yPos + 5);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(
      `Generado el ${format(new Date(), "dd/MM/yyyy HH:mm")} - Sistema de Gestión de Flota`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
    
    // Guardar
    doc.save(`Rechazo_FUEC_${vehiculo.placa}_${format(fechaIntento, "yyyyMMdd_HHmm")}.pdf`);
  };

  return (
    <div className="space-y-6" ref={reportRef}>
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            FUEC No Puede Ser Emitido
          </CardTitle>
          <CardDescription>
            Se encontraron documentos vencidos o faltantes que impiden la emisión
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Información general */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-card rounded-lg border">
            <div className="flex items-start gap-2">
              <Bus className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Vehículo</p>
                <p className="font-semibold">{vehiculo.placa}</p>
                <p className="text-sm text-muted-foreground">
                  {vehiculo.marca} {vehiculo.linea}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Conductor</p>
                <p className="font-semibold">{conductor.nombre}</p>
                <p className="text-sm text-muted-foreground">Lic: {conductor.licencia}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Contrato</p>
                <p className="font-semibold">{contrato.cliente}</p>
                <p className="text-sm text-muted-foreground">{contrato.tipo_servicio}</p>
              </div>
            </div>
          </div>

          {/* Documentos vencidos */}
          {documentosVencidos.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-destructive flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Documentos Vencidos ({documentosVencidos.length})
              </h4>
              <div className="grid gap-2">
                {documentosVencidos.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/30 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{doc.nombre}</p>
                      <p className="text-xs text-muted-foreground">{doc.mensaje}</p>
                      {doc.responsable && (
                        <p className="text-xs text-muted-foreground">
                          Responsable: {doc.responsable}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {doc.fechaVencimiento && (
                        <Badge variant="destructive" className="text-xs">
                          Venció: {format(new Date(doc.fechaVencimiento), "dd/MM/yyyy")}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documentos faltantes */}
          {documentosFaltantes.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Documentos Faltantes o N/A ({documentosFaltantes.length})
              </h4>
              <div className="grid gap-2">
                {documentosFaltantes.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-muted/50 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{doc.nombre}</p>
                      <p className="text-xs text-muted-foreground">{doc.mensaje}</p>
                      {doc.notaNA && (
                        <p className="text-xs italic">Nota: {doc.notaNA}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {doc.notaNA ? "N/A" : "Sin info"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documentos por vencer (advertencia) */}
          {documentosPorVencer.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-yellow-600 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Por Vencer - Advertencia ({documentosPorVencer.length})
              </h4>
              <div className="grid gap-2">
                {documentosPorVencer.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{doc.nombre}</p>
                      <p className="text-xs text-muted-foreground">{doc.mensaje}</p>
                    </div>
                    {doc.fechaVencimiento && (
                      <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30 text-xs">
                        {format(new Date(doc.fechaVencimiento), "dd/MM/yyyy")}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumen */}
          <div className="p-4 bg-muted rounded-lg border">
            <p className="text-sm font-medium">
              <strong>Fecha del intento:</strong>{" "}
              {format(fechaIntento, "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
            </p>
            <p className="text-sm mt-1">
              <strong>Total de problemas:</strong>{" "}
              {documentosVencidos.length + documentosFaltantes.length} documento(s)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        <Button onClick={exportarPDF} className="gap-2">
          <FileDown className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>
    </div>
  );
}
