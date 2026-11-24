import { z } from "zod";
import { maintenanceStatuses } from "@/lib/maintenance/status";

export const updateMaintenanceStatusSchema = z.object({
  new_status: z.enum(maintenanceStatuses, {
    error: "Selecione um status válido."
  }),
  description: z.string().trim().max(1000, "Use no máximo 1000 caracteres na descrição.").optional().transform((value) => value || undefined)
});

export const deleteMaintenanceOrderSchema = z.object({
  maintenance_order_id: z.string().uuid("Manutenção inválida.")
});
