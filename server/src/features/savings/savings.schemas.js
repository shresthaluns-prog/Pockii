import { z } from "zod";

export const saveSavingsBalanceSchema = z
  .object({
    amountMinor: z.number().int().safe().nonnegative(),
    currency: z.string().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()),
  })
  .strict();
