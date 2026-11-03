import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardBudgetAlerts from "../src/pages/DashboardBudgetAlerts.jsx";

const listBudgets = vi.hoisted(() => vi.fn());

vi.mock("../src/features/budgets/budgetsApi.js", () => ({
  listBudgets,
}));

function activeDates() {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function renderAlerts(budgets) {
  listBudgets.mockResolvedValue(budgets);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardBudgetAlerts categories={[{ _id: "food-id", name: "Food" }]} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("overview budget alerts", () => {
  it("shows active overall and category budgets at 80% or above", async () => {
    const dates = activeDates();
    renderAlerts([
      {
        _id: "overall",
        categoryId: null,
        amountMinor: 50000,
        spentMinor: 42000,
        percentageUsed: 84,
        status: "warning",
        currency: "NPR",
        ...dates,
      },
      {
        _id: "food",
        categoryId: "food-id",
        amountMinor: 10000,
        spentMinor: 10500,
        percentageUsed: 105,
        status: "over_budget",
        currency: "NPR",
        ...dates,
      },
      {
        _id: "safe",
        categoryId: null,
        amountMinor: 50000,
        spentMinor: 30000,
        percentageUsed: 60,
        status: "on_track",
        currency: "NPR",
        ...dates,
      },
    ]);

    expect(await screen.findByText(/you've used 105% of your Food budget/i)).toBeInTheDocument();
    expect(screen.getByText(/Careful — you've used 84% of your Overall budget/i)).toBeInTheDocument();
    expect(screen.getByText(/You've gone over the limit/)).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
    expect(screen.queryByText(/60%/)).not.toBeInTheDocument();
  });

  it("does not show an alert for an inactive budget or a budget below 80%", async () => {
    const dates = activeDates();
    const inactiveStart = new Date(Date.now() - 3 * 86_400_000);
    const inactiveEnd = new Date(Date.now() - 86_400_000);
    renderAlerts([
      {
        _id: "inactive",
        categoryId: null,
        amountMinor: 10000,
        spentMinor: 9000,
        percentageUsed: 90,
        status: "warning",
        currency: "NPR",
        startDate: inactiveStart.toISOString(),
        endDate: inactiveEnd.toISOString(),
      },
      {
        _id: "below-threshold",
        categoryId: null,
        amountMinor: 10000,
        spentMinor: 7900,
        percentageUsed: 79,
        status: "on_track",
        currency: "NPR",
        ...dates,
      },
    ]);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Budget alerts" })).not.toBeInTheDocument();
    });
  });
});
