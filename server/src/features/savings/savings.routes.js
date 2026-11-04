import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/requireAuthenticatedUser.js";
import SavingsBalance from "./savings-balance.model.js";
import { saveSavingsBalanceSchema } from "./savings.schemas.js";

const savingsRouter = Router();
savingsRouter.use(requireAuthenticatedUser);

savingsRouter.get("/", async (req, res, next) => {
  try {
    const balance = await SavingsBalance.findOne({ userId: req.authUser.id })
      .select("amountMinor currency")
      .lean();
    res.json({
      success: true,
      data: balance ? { amountMinor: balance.amountMinor, currency: balance.currency } : null,
    });
  } catch (error) {
    next(error);
  }
});

savingsRouter.put("/", async (req, res, next) => {
  const parsed = saveSavingsBalanceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Request validation failed.",
      issues: parsed.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
    });
  }

  try {
    const balance = await SavingsBalance.findOneAndUpdate(
      { userId: req.authUser.id },
      { $set: parsed.data },
      { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).select("amountMinor currency");
    res.json({
      success: true,
      data: { amountMinor: balance.amountMinor, currency: balance.currency },
    });
  } catch (error) {
    next(error);
  }
});

export default savingsRouter;
