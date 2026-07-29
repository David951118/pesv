import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface PlacaOption {
  id: string;
  placa: string;
}

// Tope de items renderizados a la vez (la lista de Cellvi puede tener miles de placas).
const MAX_VISIBLE = 80;

/**
 * Selector de placa de Cellvi con buscador. Maneja listas grandes (miles de placas)
 * filtrando en cliente y limitando cuántas se renderizan a la vez.
 */
export function CellviPlacaCombobox({
  options,
  value,
  onSelect,
  disabled,
  placeholder = "Seleccione una placa",
}: {
  options: PlacaOption[];
  /** id Cellvi seleccionado */
  value: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedPlaca = options.find((o) => o.id === value)?.placa;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, MAX_VISIBLE);
    return options.filter((o) => o.placa.toLowerCase().includes(q)).slice(0, MAX_VISIBLE);
  }, [options, query]);

  const totalMatching = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.length;
    return options.filter((o) => o.placa.toLowerCase().includes(q)).length;
  }, [options, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selectedPlaca ?? placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {/* shouldFilter=false: filtramos nosotros para poder limitar el render */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar placa..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No se encontraron placas.</CommandEmpty>
            <CommandGroup>
              {filtered.map((v) => (
                <CommandItem
                  key={v.id}
                  value={v.id}
                  onSelect={() => {
                    onSelect(v.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === v.id ? "opacity-100" : "opacity-0")}
                  />
                  {v.placa}
                </CommandItem>
              ))}
            </CommandGroup>
            {totalMatching > filtered.length && (
              <p className="px-3 py-2 text-xs text-muted-foreground border-t">
                Mostrando {filtered.length} de {totalMatching}. Escriba para filtrar.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
