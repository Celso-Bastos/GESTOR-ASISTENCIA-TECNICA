import { z } from "zod";

export const serviceCitySchema = z.string({ error: "Informe a cidade de serviço." })
  .trim()
  .min(2, "Informe a cidade de serviço com pelo menos 2 caracteres.")
  .max(120, "Use até 120 caracteres para a cidade de serviço.");

export const organizationServiceCitySchema = z.object({
  service_city: z.string().trim()
    .max(120, "Use até 120 caracteres para a cidade de serviço.")
    .refine((value) => !value || value.length >= 2, "Informe a cidade de serviço com pelo menos 2 caracteres.")
    .transform((value) => value || null)
});
