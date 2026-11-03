import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { listCategories } from "../categories/categoriesApi.js";
import {
  buttonClass,
  EmptyState,
  inputClass,
  LoadingState,
  Modal,
  Notice,
  PageHeading,
  Panel,
  secondaryButtonClass,
} from "../../components/ui.jsx";
import { amountToMinor, formatMoney, minorToAmount } from "../../utils/money.js";
import { loadPreferences } from "../settings/preferences.js";
import { createBudget, deleteBudget, listBudgets, updateBudget } from "./budgetsApi.js";

const budgetSchema = z.object({
  scope: z.enum(["overall", "category"]),
  categoryId: z.string().optional(),
  amount: z.string().trim().min(1, "Enter a budget amount."),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code."),
  periodType: z.enum(["weekly", "monthly", "custom"]),
  startDate: z.string().min(1, "Choose a start date."),
  endDate: z.string().optional(),
}).superRefine((values, context) => {
  if (values.scope === "category" && !values.categoryId) {
    context.addIssue({ code: "custom", path: ["categoryId"], message: "Choose an expense category." });
  }
  if (values.periodType === "custom" && !values.endDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "Choose an exclusive end date." });
  }
  if (values.periodType === "custom" && values.endDate && values.endDate <= values.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after start date." });
  }
});

function dateInputValue(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function getBudgetPeriodBounds(periodType, startDate, endDate) {
  if (!startDate) return null;
  const start = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;

  if (periodType === "weekly") {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }
  if (periodType === "monthly") {
    const normalizedStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return { startDate: normalizedStart.toISOString(), endDate: end.toISOString() };
  }
  if (!endDate) return null;
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(end.getTime()) || end <= start) return null;
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function getBudgetCategoryId(budget) {
  const categoryId = budget.categoryId;
  if (!categoryId) return null;
  if (typeof categoryId === "object") return String(categoryId._id ?? categoryId);
  return String(categoryId);
}

function BudgetScopeDropdown({ value, onChange, register }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const options = [
    {
      value: "overall",
      label: "Overall expenses",
      description: "Set one limit for all your spending",
      icon: "◎",
    },
    {
      value: "category",
      label: "One category",
      description: "Reserve part of your overall budget",
      icon: "▦",
    },
  ];
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return undefined;
    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isOpen]);

  function closeMenu(restoreFocus = false) {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function handleMenuKeyDown(event) {
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitemradio"]') ?? [])];
    const currentIndex = items.indexOf(document.activeElement);
    let nextIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex !== undefined && items.length > 0) {
      event.preventDefault();
      items[nextIndex].focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    }
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      ref={containerRef}
    >
      <span className="block text-sm font-medium text-slate-700" id="budget-scope-label">Budget scope</span>
      <input type="hidden" {...register("scope")} />
      <button
        aria-controls="budget-scope-menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-labelledby="budget-scope-label budget-scope-selected-value"
        className="budget-scope-trigger mt-1 flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-teal-300 hover:bg-teal-50/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !isOpen) {
            event.preventDefault();
            setIsOpen(true);
            requestAnimationFrame(() => menuRef.current?.querySelector("button")?.focus());
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="budget-scope-icon">{selectedOption.icon}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-800" id="budget-scope-selected-value">{selectedOption.label}</span>
            <span className="mt-0.5 block truncate text-xs font-normal text-slate-500">{selectedOption.description}</span>
          </span>
        </span>
        <svg aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 20 20" stroke="currentColor">
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        </svg>
      </button>
      {isOpen && (
        <div
          aria-labelledby="budget-scope-label"
          className="budget-scope-menu absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
          id="budget-scope-menu"
          onKeyDown={handleMenuKeyDown}
          ref={menuRef}
          role="menu"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                aria-checked={isSelected}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  isSelected ? "bg-teal-50 text-teal-950" : "text-slate-700 hover:bg-slate-50"
                }`}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  closeMenu(true);
                }}
                role="menuitemradio"
                type="button"
              >
                <span aria-hidden="true" className={`budget-scope-icon ${isSelected ? "is-selected" : ""}`}>{option.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
                </span>
                {isSelected && <span aria-hidden="true" className="text-sm font-bold text-teal-700">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BudgetCategoryDropdown({ categories, form, error }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCategoryId = useWatch({ control: form.control, name: "categoryId" });
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const selectedCategory = categories.find((category) => category._id === selectedCategoryId);
  const labelId = "budget-category-label";

  useEffect(() => {
    if (!isOpen) return undefined;
    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isOpen]);

  function closeMenu(restoreFocus = false) {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function handleMenuKeyDown(event) {
    const options = [...(menuRef.current?.querySelectorAll('[role="menuitemradio"]') ?? [])];
    const currentIndex = options.indexOf(document.activeElement);
    let nextIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = options.length - 1;
    if (nextIndex !== undefined && options.length > 0) {
      event.preventDefault();
      options[nextIndex].focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    }
  }

  return (
    <div
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      ref={containerRef}
    >
      <span className="block leading-4 text-sm font-medium text-slate-700" id={labelId}>Expense category</span>
      <input type="hidden" {...form.register("categoryId")} />
      <button
        aria-controls="budget-category-menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-labelledby={`${labelId} budget-category-value`}
        className={`${inputClass} flex items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
        disabled={categories.length === 0}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !isOpen) {
            event.preventDefault();
            setIsOpen(true);
            requestAnimationFrame(() => menuRef.current?.querySelector("button")?.focus());
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedCategory ? (
            <>
              <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: selectedCategory.color }} />
              <span className="truncate text-slate-900" id="budget-category-value">{selectedCategory.name}</span>
            </>
          ) : (
            <span id="budget-category-value">{categories.length === 0 ? "No categories available" : "Select category"}</span>
          )}
        </span>
        <svg aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 20 20" stroke="currentColor">
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        </svg>
      </button>
      {isOpen && (
        <div
          aria-labelledby={labelId}
          className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
          id="budget-category-menu"
          onKeyDown={handleMenuKeyDown}
          ref={menuRef}
          role="menu"
        >
          {categories.length ? categories.map((category) => {
            const isSelected = category._id === selectedCategoryId;
            return (
              <button
                aria-checked={isSelected}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  isSelected ? "bg-teal-50 font-semibold text-teal-900" : "text-slate-700 hover:bg-slate-50"
                }`}
                key={category._id}
                onClick={() => {
                  form.setValue("categoryId", category._id, { shouldDirty: true, shouldValidate: true });
                  closeMenu(true);
                }}
                role="menuitemradio"
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: category.color }}
                >
                  {category.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">{category.name}</span>
                {isSelected && <span aria-hidden="true" className="text-teal-700">✓</span>}
              </button>
            );
          }) : (
            <p className="px-3 py-2.5 text-sm text-slate-500">No categories available</p>
          )}
        </div>
      )}
      {error && <span className="mt-1 block text-xs text-rose-700">{error}</span>}
    </div>
  );
}

function emptyValues() {
  return {
    scope: "overall",
    categoryId: "",
    amount: "",
    currency: loadPreferences().currency,
    periodType: "monthly",
    startDate: dateInputValue(),
    endDate: "",
  };
}

function BudgetsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const categoriesQuery = useQuery({
    queryKey: ["categories", "expense"],
    queryFn: () => listCategories({ type: "expense" }),
  });
  const budgetsQuery = useQuery({
    queryKey: ["budgets"],
    queryFn: () => listBudgets(),
  });
  const form = useForm({ resolver: zodResolver(budgetSchema), defaultValues: emptyValues() });
  const { reset } = form;
  const scope = useWatch({ control: form.control, name: "scope" });
  const periodType = useWatch({ control: form.control, name: "periodType" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const currency = useWatch({ control: form.control, name: "currency" });
  const startDate = useWatch({ control: form.control, name: "startDate" });
  const endDate = useWatch({ control: form.control, name: "endDate" });
  const expenses = (categoriesQuery.data ?? []).filter((category) => category.type === "expense");
  const budgets = budgetsQuery.data ?? [];
  const periodBounds = getBudgetPeriodBounds(periodType, startDate, endDate);
  const currencyCode = String(currency ?? "").trim().toUpperCase();
  const samePeriodAndCurrency = (budget) =>
    budget.currency === currencyCode &&
    periodBounds &&
    new Date(budget.startDate).toISOString() === periodBounds.startDate &&
    new Date(budget.endDate).toISOString() === periodBounds.endDate;
  const overallBudget = budgets.find(
    (budget) => !getBudgetCategoryId(budget) && budget._id !== editing?._id && samePeriodAndCurrency(budget),
  );
  const editingOverallBudget =
    editing && !getBudgetCategoryId(editing) && samePeriodAndCurrency(editing) ? editing : null;
  const allocatedCategoryMinor = budgets
    .filter(
      (budget) =>
        getBudgetCategoryId(budget) &&
        budget._id !== editing?._id &&
        samePeriodAndCurrency(budget),
    )
    .reduce((total, budget) => total + budget.amountMinor, 0);
  const availableCategoryMinor = overallBudget
    ? Math.max(0, overallBudget.remainingMinor - allocatedCategoryMinor)
    : 0;
  const overallSpentMinor = (overallBudget ?? editingOverallBudget)?.spentMinor ?? 0;
  let enteredAmountMinor = null;
  try {
    if (amount) enteredAmountMinor = amountToMinor(amount, currencyCode);
  } catch {
    enteredAmountMinor = null;
  }
  const categoryAmountExceeded =
    scope === "category" &&
    enteredAmountMinor !== null &&
    overallBudget &&
    enteredAmountMinor > availableCategoryMinor;
  const overallAmountBelowAllocations =
    scope === "overall" &&
    enteredAmountMinor !== null &&
    enteredAmountMinor < allocatedCategoryMinor + overallSpentMinor;

  useEffect(() => {
    if (editing) {
      const categoryId = typeof editing.categoryId === "object" ? editing.categoryId?._id : editing.categoryId;
      reset({
        scope: categoryId ? "category" : "overall",
        categoryId: categoryId ?? "",
        amount: minorToAmount(editing.amountMinor, editing.currency),
        currency: editing.currency,
        periodType: editing.periodType,
        startDate: dateInputValue(editing.startDate),
        endDate: editing.periodType === "custom" ? dateInputValue(editing.endDate) : "",
      });
    } else {
      reset(emptyValues());
    }
    setFormError("");
  }, [editing, reset]);

  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["budgets"] }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  }

  const saveMutation = useMutation({
    mutationFn: (values) => editing ? updateBudget(editing._id, values) : createBudget(values),
    onSuccess: async () => {
      setEditing(null);
      setFormOpen(false);
      setFormError("");
      await refreshData();
    },
    onError: (error) => setFormError(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteBudget,
    onSuccess: refreshData,
    onError: (error) => setFormError(error.message),
  });

  async function onSubmit(values) {
    setFormError("");
    try {
      const payload = {
        categoryId: values.scope === "category" ? values.categoryId : null,
        amountMinor: amountToMinor(values.amount, values.currency.toUpperCase()),
        currency: values.currency.toUpperCase(),
        periodType: values.periodType,
        startDate: values.startDate,
      };
      if (values.periodType === "custom") payload.endDate = values.endDate;
      await saveMutation.mutateAsync(payload);
    } catch (error) {
      setFormError(error.message);
    }
  }

  function handleDelete(budget) {
    if (!window.confirm("Delete this budget? Transaction history will not be affected.")) return;
    setFormError("");
    deleteMutation.mutate(budget._id);
  }

  const fieldError = form.formState.errors;
  function openCreateForm() {
    setEditing(null);
    setFormError("");
    reset(emptyValues());
    setFormOpen(true);
  }

  function closeForm() {
    setEditing(null);
    setFormOpen(false);
  }

  return (
    <div className="space-y-7">
      <PageHeading
        eyebrow="Plan ahead"
        title="Budgets"
        description="Set spending limits and track usage against your expense transactions."
        action={<button className={buttonClass} onClick={openCreateForm} type="button">＋ Create budget</button>}
      />
      {formError && <Notice>{formError}</Notice>}
      {formOpen && (
        <Modal
          description="Category budgets must fit within the matching overall budget."
          onClose={closeForm}
          title={editing ? "Edit budget" : "Create a budget"}
        >
          {categoriesQuery.isError && <Notice>{categoriesQuery.error.message}</Notice>}
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <BudgetScopeDropdown
              onChange={(value) => form.setValue("scope", value, { shouldDirty: true, shouldValidate: true })}
              register={form.register}
              value={scope}
            />
            {scope === "category" && (
              <BudgetCategoryDropdown
                categories={expenses}
                error={fieldError.categoryId?.message}
                form={form}
              />
            )}
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <label className="block text-sm font-medium text-slate-700">
                Limit
                <input className={inputClass} inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
                {fieldError.amount && <span className="mt-1 block text-xs text-rose-700">{fieldError.amount.message}</span>}
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Currency
                <input className={`${inputClass} uppercase`} maxLength={3} {...form.register("currency")} />
                {fieldError.currency && <span className="mt-1 block text-xs text-rose-700">{fieldError.currency.message}</span>}
              </label>
            </div>
            {scope === "category" && (
              <div className="text-xs leading-5" role="status">
                {budgetsQuery.isPending && <p className="text-slate-500">Loading the overall budget for this period…</p>}
                {budgetsQuery.isError && <p className="text-rose-700">Could not verify the overall budget: {budgetsQuery.error.message}</p>}
                {budgetsQuery.isSuccess && !overallBudget && (
                  <p className="text-rose-700">Create an overall budget for this period and currency before adding category budgets.</p>
                )}
                {overallBudget && (
                  <p className="text-slate-600">
                    Available for category budgets: <strong>{formatMoney(availableCategoryMinor, currencyCode)}</strong> of {formatMoney(overallBudget.remainingMinor, currencyCode)} remaining in the overall budget.
                  </p>
                )}
                {categoryAmountExceeded && (
                  <p className="mt-1 text-rose-700" role="alert">This limit exceeds the unspent amount remaining in the overall budget.</p>
                )}
              </div>
            )}
            {scope === "overall" && allocatedCategoryMinor > 0 && (
              <p className="text-xs leading-5 text-slate-600" role="status">
                This period already has {formatMoney(overallSpentMinor, currencyCode)} spent and {formatMoney(allocatedCategoryMinor, currencyCode)} allocated to categories.
                {overallAmountBelowAllocations && (
                  <span className="mt-1 block text-rose-700" role="alert">The overall limit must cover both spending to date and category allocations.</span>
                )}
              </p>
            )}
            <label className="block text-sm font-medium text-slate-700">
              Period
              <select className={inputClass} {...form.register("periodType")}>
                <option value="weekly">Weekly (Monday through Sunday)</option>
                <option value="monthly">Monthly (UTC calendar month)</option>
                <option value="custom">Custom date range</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {periodType === "monthly" ? "Any day in the month" : periodType === "weekly" ? "Any day in the week" : "Start date (inclusive)"}
              <input className={inputClass} type="date" {...form.register("startDate")} />
              {fieldError.startDate && <span className="mt-1 block text-xs text-rose-700">{fieldError.startDate.message}</span>}
            </label>
            {periodType === "custom" && (
              <label className="block text-sm font-medium text-slate-700">
                End date (exclusive)
                <input className={inputClass} type="date" {...form.register("endDate")} />
                {fieldError.endDate && <span className="mt-1 block text-xs text-rose-700">{fieldError.endDate.message}</span>}
              </label>
            )}
            <p className="text-xs leading-5 text-slate-500">Weekly and monthly dates are normalized using UTC. Custom end dates are exclusive.</p>
            <div className="flex flex-wrap gap-2">
              <button
                className={buttonClass}
                disabled={
                  saveMutation.isPending ||
                  (scope === "category" &&
                    (expenses.length === 0 ||
                      budgetsQuery.isPending ||
                      budgetsQuery.isError ||
                      !overallBudget ||
                      categoryAmountExceeded)) ||
                  overallAmountBelowAllocations
                }
                type="submit"
              >
                {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Add budget"}
              </button>
              <button className={secondaryButtonClass} onClick={closeForm} type="button">Cancel</button>
            </div>
          </form>
        </Modal>

      )}
      <Panel title="Your budgets" description="Usage is calculated from this account's matching expenses.">
          {budgetsQuery.isPending && <LoadingState label="Loading budgets…" />}
          {budgetsQuery.isError && <Notice>{budgetsQuery.error.message}</Notice>}
          {budgetsQuery.isSuccess && budgets.length === 0 && (
            <EmptyState title="No budgets yet" description="Create an overall or category budget to start tracking your spending." />
          )}
          <div className="space-y-3">
            {budgets.map((budget) => (
              <BudgetCard
                budget={budget}
                categoryName={expenses.find((category) => category._id === budget.categoryId)?.name}
                key={budget._id}
                onDelete={() => void handleDelete(budget)}
                onEdit={() => {
                  setFormError("");
                  setEditing(budget);
                  setFormOpen(true);
                }}
              />
            ))}
          </div>
      </Panel>
    </div>
  );
}

function BudgetCard({ budget, categoryName, onEdit, onDelete }) {
  const percent = Number(budget.percentageUsed) || 0;
  const stateClasses = {
    on_track: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    over_budget: "bg-rose-50 text-rose-700",
  };
  const statusLabel = budget.status?.replaceAll("_", " ") ?? "on track";
  const title = budget.categoryId ? `${categoryName ?? "Category"} budget` : "Overall budget";
  const start = dateInputValue(budget.startDate);
  const end = dateInputValue(budget.endDate);

  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs capitalize text-slate-500">
            {budget.periodType} · {start} – {end} (end exclusive)
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${stateClasses[budget.status] ?? stateClasses.on_track}`}>{statusLabel}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Spent</p>
          <p className="mt-0.5 text-xl font-semibold text-slate-900">{formatMoney(budget.spentMinor, budget.currency)}</p>
        </div>
        <p className="text-right text-sm text-slate-500">
          of <span className="font-semibold text-slate-800">{formatMoney(budget.amountMinor, budget.currency)}</span>
          <span className="mt-0.5 block">{formatMoney(budget.remainingMinor, budget.currency)} remaining</span>
        </p>
      </div>
      <div aria-label={`${Math.max(0, percent).toFixed(2)} percent used`} className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.max(0, Math.min(percent, 100))} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-all ${budget.status === "over_budget" ? "bg-rose-500" : budget.status === "warning" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{percent.toFixed(2)}% used</span>
        <div className="flex gap-2">
          <button className={secondaryButtonClass} onClick={onEdit} type="button">Edit</button>
          <button className="rounded-xl px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50" onClick={onDelete} type="button">Delete</button>
        </div>
      </div>
    </article>
  );
}

export default BudgetsPage;
