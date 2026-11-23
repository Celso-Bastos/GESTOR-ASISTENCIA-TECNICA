import { z } from "zod";
import { parseCurrencyInput } from "@/lib/products/format";

export const inventoryMovementSchema = z.object({
  model_id: z.string().uuid("Produto inválido."),
  movement_type: z.enum(["opening_balance", "entry", "adjustment"]),
  quantity: z.preprocess(value => value === "" || value == null ? NaN : Number(value),
    z.number({ error: "Informe a quantidade." }).int("A quantidade deve ser inteira.").min(0, "Informe uma quantidade não negativa.").max(2147483647)),
  unit_cost: z.preprocess(value => String(value ?? "").trim() === "" ? undefined : parseCurrencyInput(value as string | number | null) ?? NaN,
    z.number().min(0, "O custo deve ser não negativo.").max(99999999.99).optional()),
  reason: z.string().trim().max(200),
  notes: z.string().trim().max(1000)
}).superRefine((value, ctx) => {
  if (value.movement_type === "entry" && value.quantity <= 0) {
    ctx.addIssue({ code: "custom", path: ["quantity"], message: "A entrada deve ser maior que zero." });
  }
  if (value.movement_type === "adjustment" && !value.reason) {
    ctx.addIssue({ code: "custom", path: ["reason"], message: "Informe o motivo do ajuste." });
  }
});
