import { cn } from "@/lib/utils";

type StatusType = "warning" | "danger" | "success" | "neutral" | "active" | "pending" | "blocked";

interface StatusBadgeProps {
  status: StatusType;
  children: React.ReactNode;
  size?: "sm" | "default";
}

const statusStyles: Record<StatusType, string> = {
  warning: "status-warning",
  danger: "status-danger",
  success: "status-success",
  neutral: "status-neutral",
  active: "status-active",
  pending: "status-pending",
  blocked: "status-blocked",
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-[10px]",
  default: "px-2.5 py-1 text-xs",
};

export function StatusBadge({ status, children, size = "default" }: StatusBadgeProps) {
  return (
    <span className={cn("status-badge", statusStyles[status], sizeStyles[size])}>
      {children}
    </span>
  );
}