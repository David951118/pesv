import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmpresasList } from "@/hooks/useEmpresasList";

export const TIPO_DOCUMENTO_OPTIONS: { value: string; label: string }[] = [
  { value: "SOAT", label: "SOAT" },
  { value: "TECNOMECANICA", label: "Tecnomecanica" },
  { value: "TARJETA_OPERACION", label: "Tarjeta de Operacion" },
  { value: "TARJETA_PROPIEDAD", label: "Tarjeta de Propiedad" },
  { value: "REVISION_PREVENTIVA", label: "Revision Preventiva" },
  { value: "POLIZA_RCE", label: "Poliza RCE" },
  { value: "POLIZA_RCC", label: "Poliza RCC" },
  { value: "LICENCIA_CONDUCCION", label: "Licencia de Conduccion" },
  { value: "CEDULA", label: "Cedula" },
  { value: "ARL", label: "ARL" },
  { value: "EPS", label: "EPS" },
  { value: "CAJA_COMPENSACION", label: "Caja de Compensacion" },
  { value: "FONDO_PENSIONES", label: "Fondo de Pensiones" },
  { value: "EXAMEN_MEDICO", label: "Examen Medico" },
  { value: "CAPACITACION_PESV", label: "Capacitacion PESV" },
  { value: "CONTRATO_CLIENTE", label: "Contrato Cliente" },
  { value: "CAMARA_COMERCIO", label: "Camara de Comercio" },
  { value: "RUT", label: "RUT" },
  { value: "OTRO", label: "Otro" },
];

const ESTADO_OPTIONS = ["VIGENTE", "POR_VENCER", "VENCIDO", "HISTORICO", "RECHAZADO"];
const ENTIDAD_OPTIONS = [
  { value: "Vehiculo", label: "Vehiculo" },
  { value: "Tercero", label: "Tercero" },
  { value: "Empresa", label: "Empresa" },
];

export interface DocumentosFilterValues {
  search: string;
  entidadModelo: string;
  estado: string;
  tipoDocumento: string;
  empresaId: string;
}

interface DocumentosFiltersProps {
  filters: DocumentosFilterValues;
  onFilterChange: (filters: DocumentosFilterValues) => void;
  onCreateClick: () => void;
  isAdmin: boolean;
}

export function DocumentosFilters({ filters, onFilterChange, onCreateClick, isAdmin }: DocumentosFiltersProps) {
  const { data: empresas = [] } = useEmpresasList();
  const update = (key: keyof DocumentosFilterValues, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {isAdmin && empresas.length > 0 && (
        <Select value={filters.empresaId} onValueChange={(v) => update("empresaId", v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las empresas</SelectItem>
            {empresas.map((e) => (
              <SelectItem key={e._id} value={e._id}>{e.razonSocial}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="relative w-56">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por tipo, numero..."
          value={filters.search}
          onChange={(e) => update("search", e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={filters.entidadModelo} onValueChange={(v) => update("entidadModelo", v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Entidad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas</SelectItem>
          {ENTIDAD_OPTIONS.map((e) => (
            <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.estado} onValueChange={(v) => update("estado", v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {ESTADO_OPTIONS.map((e) => (
            <SelectItem key={e} value={e}>{e.replace("_", " ")}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.tipoDocumento} onValueChange={(v) => update("tipoDocumento", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Tipo Documento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {TIPO_DOCUMENTO_OPTIONS.map((t) => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isAdmin && (
        <Button onClick={onCreateClick} className="gap-2 ml-auto">
          <Plus className="h-4 w-4" />
          Nuevo Documento
        </Button>
      )}
    </div>
  );
}
