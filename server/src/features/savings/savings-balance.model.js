import mongoose from "mongoose";

const savingsBalanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amountMinor: {
      type: Number,
      required: true,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      validate: {
        validator: Number.isSafeInteger,
        message: "amountMinor must be a safe integer in the currency's minor unit.",
      },
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      match: [/^[A-Z]{3}$/, "currency must be a three-letter ISO 4217 code."],
    },
  },
  { timestamps: true },
);

savingsBalanceSchema.index({ userId: 1 }, { unique: true, name: "savings_balance_user_unique" });

const SavingsBalance =
  mongoose.models.SavingsBalance ?? mongoose.model("SavingsBalance", savingsBalanceSchema);

export default SavingsBalance;
