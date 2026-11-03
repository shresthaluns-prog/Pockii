import { useQuery } from "@tanstack/react-query";
import { listBudgets } from "../features/budgets/budgetsApi.js";
import { formatMoney } from "../utils/money.js";
import { Notice, Panel } from "../components/ui.jsx";

function categoryIdOf(budget) {
  const categoryId = budget.categoryId;
  if (!categoryId) return null;
  return typeof categoryId === "object" ? String(categoryId._id ?? categoryId) : String(categoryId);
}

export function getActiveBudgetAlerts(budgets, now = Date.now()) {
  return budgets
    .filter((budget) => {
      const start = Date.parse(budget.startDate);
      const end = Date.parse(budget.endDate);
      const percentageUsed = Number(budget.percentageUsed);
      return (
        start <= now &&
        now < end &&
        Number.isFinite(percentageUsed) &&
        percentageUsed >= 80
      );
    })
    .sort((left, right) => Number(right.percentageUsed) - Number(left.percentageUsed));
}

function DashboardBudgetAlerts({ categories = [] }) {
  const budgetsQuery = useQuery({
    queryKey: ["budgets"],
    queryFn: () => listBudgets(),
    staleTime: 30_000,
  });

  if (budgetsQuery.isPending) {
    return null;
  }
  if (budgetsQuery.isError) {
    return <Notice>{`Budget alerts unavailable: ${budgetsQuery.error.message}`}</Notice>;
  }

  const alerts = getActiveBudgetAlerts(budgetsQuery.data ?? []);
  if (alerts.length === 0) return null;

  return (
    <Panel
      className="dashboard-budget-alerts-panel"
      title="Budget alerts"
      description="A heads-up when your spending gets close to a limit."
    >
      <ul aria-label="Budgets nearing or over their limits" className="dashboard-budget-alerts">
        {alerts.map((budget) => {
          const percentageUsed = Number(budget.percentageUsed);
          const overBudget = percentageUsed > 100 || budget.status === "over_budget";
          const categoryId = categoryIdOf(budget);
          const category = categories.find((item) => item._id === categoryId);
          const budgetName = categoryId ? `${category?.name ?? "Category"} budget` : "Overall budget";
          const message = overBudget
            ? `You've used ${percentageUsed.toFixed(0)}% of your ${budgetName}. You've gone over the limit.`
            : `Careful — you've used ${percentageUsed.toFixed(0)}% of your ${budgetName}. You're getting close to your limit.`;

          return (
            <li
              aria-live="polite"
              className={`dashboard-budget-alert${overBudget ? " is-over-budget" : ""}`}
              key={budget._id}
              role="status"
            >
              <span aria-hidden="true" className="dashboard-budget-alert-icon">{overBudget ? "!" : "↗"}</span>
              <div className="dashboard-budget-alert-copy">
                <strong>{message}</strong>
                <span>{formatMoney(budget.spentMinor, budget.currency)} spent of {formatMoney(budget.amountMinor, budget.currency)}</span>
                <div
                  aria-label={`${Math.max(0, percentageUsed).toFixed(0)} percent of ${budgetName} used`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={Math.min(Math.max(percentageUsed, 0), 100)}
                  className="dashboard-budget-alert-track"
                  role="progressbar"
                >
                  <span style={{ width: `${Math.min(Math.max(percentageUsed, 0), 100)}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export default DashboardBudgetAlerts;
