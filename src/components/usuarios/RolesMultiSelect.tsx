import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface RoleOption {
  /** Clave estable para la UI. */
  value: string;
  label: string;
  /** Aclaración corta bajo la etiqueta. */
  hint?: string;
  /**
   * Qué se guarda al seleccionar esta opción. Puede aportar un rol de negocio
   * (Tercero.roles) y/o un rol de acceso al sistema (Tercero.rolesSistema, con
   * prefijo ROLE_). splitRoles() los separa luego por el prefijo.
   */
  tokens: string[];
}

// Perfil / roles de negocio. Son etiquetas de la persona; por sí solos NO dan
// acceso a la plataforma (el login del conductor lo otorga Cellvi).
export const BUSINESS_ROLES: RoleOption[] = [
  { value: "CONDUCTOR", label: "Conductor", tokens: ["CONDUCTOR"] },
  { value: "PROPIETARIO", label: "Propietario", tokens: ["PROPIETARIO"] },
  { value: "CLIENTE", label: "Cliente", tokens: ["CLIENTE"] },
  { value: "ADMINISTRATIVO", label: "Administrativo", tokens: ["ADMINISTRATIVO"] },
  { value: "PROVEEDOR", label: "Proveedor", tokens: ["PROVEEDOR"] },
];

// Acceso al sistema: permiten iniciar sesión (requieren Usuario Cellvi).
// "Mecánico" es una sola opción que marca a la vez el perfil de negocio
// (para poder asignarlo a órdenes de trabajo) y el acceso al sistema.
export const ACCESS_ROLES: RoleOption[] = [
  {
    value: "MECANICO",
    label: "Mecánico",
    hint: "opera órdenes de trabajo",
    tokens: ["MECANICO", "ROLE_MECANICO"],
  },
  {
    value: "AUDITOR",
    label: "Auditor",
    hint: "solo lectura",
    tokens: ["ROLE_AUDITOR"],
  },
];

// Roles de "Acceso al sistema" (Mecánico/Auditor) visibles en la UI de
// creación/edición de usuarios. Poner en false para ocultarlos sin borrar lógica.
export const SHOW_ACCESS_ROLES = true;

const ALL_OPTIONS: RoleOption[] = [...BUSINESS_ROLES, ...ACCESS_ROLES];

/** Etiqueta legible para un token de rol suelto (fallback: el token crudo). */
export function roleLabel(token: string): string {
  const opt = ALL_OPTIONS.find((r) => r.tokens.includes(token));
  return opt?.label ?? token;
}

// Regla de negocio: todo tercero debe quedar enlazado a un Usuario Cellvi,
// salvo el proveedor (empresa externa que no entra a la plataforma). El API
// solo exige el usuario para los roles que inician sesión, porque el módulo
// FUEC crea contratantes (Cliente) sin usuario; esta regla más estricta se
// aplica aquí, en el formulario de Usuarios.
export const ROLES_SIN_USUARIO_CELLVI = ["PROVEEDOR"];

/**
 * Indica si la lista unificada de roles obliga a diligenciar Usuario Cellvi:
 * cualquier rol distinto de proveedor (incluidos los ROLE_* de acceso).
 */
export function requiereUsuarioCellvi(values: string[]): boolean {
  return (values ?? []).some((v) => !ROLES_SIN_USUARIO_CELLVI.includes(v));
}

/** Separa la lista unificada en roles de negocio y roles de sistema (ROLE_*). */
export function splitRoles(values: string[]): {
  roles: string[];
  rolesSistema: string[];
} {
  return {
    roles: values.filter((v) => !v.startsWith("ROLE_")),
    rolesSistema: values.filter((v) => v.startsWith("ROLE_")),
  };
}

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}

export function RolesMultiSelect({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ?? [];

  const isChecked = (opt: RoleOption) =>
    opt.tokens.some((t) => selected.includes(t));

  const toggle = (opt: RoleOption) => {
    if (isChecked(opt)) {
      onChange(selected.filter((v) => !opt.tokens.includes(v)));
    } else {
      onChange([
        ...selected,
        ...opt.tokens.filter((t) => !selected.includes(t)),
      ]);
    }
    // Cerrar el desplegable tras elegir; para marcar otro rol se vuelve a abrir
    setOpen(false);
  };

  const checkedOptions = ALL_OPTIONS.filter(isChecked);
  // Tokens que quedaron en el valor pero no corresponden a ninguna opción
  // (p. ej. ROLE_ADMIN/CLIENTE_ADMIN provenientes de Cellvi): se conservan y se
  // muestran para no ocultarlos ni perderlos al guardar.
  const covered = new Set(checkedOptions.flatMap((o) => o.tokens));
  const leftover = selected.filter((v) => !covered.has(v));

  const renderGroup = (title: string, items: RoleOption[]) => (
    <div className="py-1">
      <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{title}</p>
      {items.map((opt) => {
        const checked = isChecked(opt);
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => toggle(opt)}
            className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40",
              )}
            >
              {checked && <Check className="h-3 w-3" />}
            </span>
            <span className="flex flex-col text-left">
              <span>{opt.label}</span>
              {opt.hint && (
                <span className="text-xs text-muted-foreground">{opt.hint}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-auto min-h-10 w-full justify-between", className)}
        >
          <div className="flex flex-wrap gap-1">
            {checkedOptions.length === 0 && leftover.length === 0 ? (
              <span className="text-muted-foreground font-normal">Seleccione roles...</span>
            ) : (
              <>
                {checkedOptions.map((opt) => (
                  <Badge key={opt.value} variant="secondary" className="font-normal">
                    {opt.label}
                  </Badge>
                ))}
                {leftover.map((v) => (
                  <Badge key={v} variant="outline" className="font-normal">
                    {roleLabel(v)}
                  </Badge>
                ))}
              </>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
        <div className="max-h-72 overflow-y-auto">
          {renderGroup("Perfil (qué es la persona)", BUSINESS_ROLES)}
          {SHOW_ACCESS_ROLES && (
            <>
              <div className="my-1 h-px bg-border" />
              {renderGroup("Acceso al sistema (inicia sesión)", ACCESS_ROLES)}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
