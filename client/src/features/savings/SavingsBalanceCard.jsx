import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { inputClass, Notice, Panel } from "../../components/ui.jsx";
import { amountToMinor, formatMoney, minorToAmount } from "../../utils/money.js";
import { fetchSavingsBalance, saveSavingsBalance } from "./savingsApi.js";

function SavingsBalanceCard({ currency, userId }) {
  const queryClient = useQueryClient();
  const queryKey = ["savings", userId];
  const balanceQuery = useQuery({
    queryKey,
    queryFn: fetchSavingsBalance,
    enabled: Boolean(userId),
  });
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState("");
  const saveMutation = useMutation({
    mutationFn: saveSavingsBalance,
    onSuccess: async () => {
      setAmountError("");
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  useEffect(() => {
    if (!balanceQuery.isSuccess) return;
    setAmount(
      balanceQuery.data?.currency === currency
        ? minorToAmount(balanceQuery.data.amountMinor, currency)
        : "",
    );
    setAmountError("");
  }, [balanceQuery.data, balanceQuery.isSuccess, currency]);

  function submit(event) {
    event.preventDefault();
    setAmountError("");
    try {
      const amountMinor = amountToMinor(amount, currency, { allowZero: true });
      saveMutation.mutate({ amountMinor, currency });
    } catch (error) {
      setAmountError(error.message);
    }
  }

  return (
    <Panel
      title="Savings balance"
      description="Keep a manually updated savings balance on your account. It is not calculated from income or expenses."
    >
      {balanceQuery.isPending && <p className="text-sm text-slate-500">Loading savings balance…</p>}
      {balanceQuery.isError && <Notice>{`Savings balance unavailable: ${balanceQuery.error.message}`}</Notice>}
      {balanceQuery.isSuccess && (
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500">Saved balance</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              {balanceQuery.data
                ? formatMoney(balanceQuery.data.amountMinor, balanceQuery.data.currency)
                : "No balance saved"}
            </p>
            {balanceQuery.data && balanceQuery.data.currency !== currency && (
              <p className="mt-2 text-sm text-slate-500">
                This balance is in {balanceQuery.data.currency}. Saving below in {currency} will replace it; currencies are not converted.
              </p>
            )}
          </div>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={submit}>
            <label className="block text-sm font-medium text-slate-700">
              Balance in {currency}
              <input
                className={inputClass}
                min="0"
                required
                step="any"
                type="number"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setAmountError("");
                }}
              />
            </label>
            <button
              className="ui-button inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition"
              disabled={saveMutation.isPending || amount === ""}
              type="submit"
            >
              {saveMutation.isPending ? "Saving…" : "Save balance"}
            </button>
          </form>
        </div>
      )}
      {amountError && <div className="mt-3"><Notice>{amountError}</Notice></div>}
      {saveMutation.isError && <div className="mt-3"><Notice>{saveMutation.error.message}</Notice></div>}
      {saveMutation.isSuccess && <p className="mt-3 text-sm text-emerald-700" role="status">Savings balance saved.</p>}
    </Panel>
  );
}

export default SavingsBalanceCard;
