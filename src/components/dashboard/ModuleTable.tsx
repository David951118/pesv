import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  className?: string;
}

interface ModuleTableProps {
  title: string;
  icon: React.ReactNode;
  columns: Column[];
  data: Record<string, React.ReactNode>[];
  emptyMessage?: string;
}

export function ModuleTable({ 
  title, 
  icon, 
  columns, 
  data, 
  emptyMessage = "No hay datos disponibles" 
}: ModuleTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    
    return data.filter((row) => {
      return columns.some((column) => {
        const value = row[column.key];
        if (typeof value === "string") {
          return value.toLowerCase().includes(searchTerm.toLowerCase());
        }
        return false;
      });
    });
  }, [data, columns, searchTerm]);

  return (
    <div className="bg-card rounded-lg border border-border shadow-corporate overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-table-header to-background flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary">{title}</h3>
            <span className="text-xs text-muted-foreground">
              {filteredData.length} de {data.length} registros
            </span>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-background"
          />
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-table-header hover:bg-table-header border-b border-table-border">
              {columns.map((column) => (
                <TableHead 
                  key={column.key}
                  className={cn(
                    "text-foreground font-semibold text-xs uppercase tracking-wider py-3",
                    column.className
                  )}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={columns.length} 
                  className="text-center text-muted-foreground py-12"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-muted">
                      <Search className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span>{searchTerm ? "No se encontraron resultados" : emptyMessage}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((row, index) => (
                <TableRow 
                  key={index}
                  className="hover:bg-table-row-hover transition-colors border-b border-table-border last:border-0"
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={cn("py-3", column.className)}>
                      {row[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}