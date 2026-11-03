import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BudgetsPage from "../src/features/budgets/BudgetsPage.jsx";

const api = vi.hoisted(() => ({
  listCategories: vi.fn(),
  listBudgets: vi.fn(),
  createBudget: vi.fn(),
  updateBudget: vi.fn(),
  deleteBudget: vi.fn(),
}));

vi.mock("../src/features/categories/categoriesApi.js", () => ({
  listCategories: api.listCategories,
}));

vi.mock("../src/features/budgets/budgetsApi.js", () => ({
  listBudgets: api.listBudgets,
  createBudget: api.createBudget,
  updateBudget: api.updateBudget,
  deleteBudget: api.deleteBudget,
}));

function currentMonthBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BudgetsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
  api.listCategories.mockResolvedValue([
    { _id: "category-food", name: "Food", type: "expense" },
    { _id: "category-home", name: "Home", type: "expense" },
  ]);
  api.listBudgets.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("category budget allocations", () => {
  it("uses the themed period dropdown and shows the custom end date when selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Create budget/ }));
    const dialog = screen.getByRole("dialog");
    const periodTrigger = within(dialog).getByRole("button", { name: "Period Monthly" });
    expect(periodTrigger).toBeInTheDocument();

    await user.click(periodTrigger);
    await user.click(within(dialog).getByRole("menuitemradio", { name: "Custom date range" }));

    expect(within(dialog).getByRole("button", { name: "Period Custom date range" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("End date (exclusive)")).toBeInTheDocument();
  });

  it("requires a matching overall budget before allowing a category budget", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Create budget/ }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Budget scope Overall expenses/ }));
    await user.click(within(dialog).getByRole("menuitemradio", { name: /^One category/ }));

    expect(await within(dialog).findByText(/Create an overall budget for this period/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add budget" })).toBeDisabled();
  });

  it("limits a category budget to the overall budget's unspent amount", async () => {
    const user = userEvent.setup();
    const { startDate, endDate } = currentMonthBounds();
    api.listBudgets.mockResolvedValue([
      {
        _id: "overall",
        categoryId: null,
        amountMinor: 5000000,
        currency: "NPR",
        periodType: "monthly",
        startDate,
        endDate,
        spentMinor: 2100000,
        remainingMinor: 2900000,
        percentageUsed: 42,
        status: "on_track",
      },
    ]);
    renderPage();

    const userReady = await screen.findByRole("button", { name: /Create budget/ });
    await user.click(userReady);
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Budget scope Overall expenses/ }));
    await user.click(within(dialog).getByRole("menuitemradio", { name: /^One category/ }));
    await user.click(within(dialog).getByRole("button", { name: /Expense category Select category/ }));
    await user.click(within(dialog).getByRole("menuitemradio", { name: "Home" }));
    expect(await within(dialog).findByRole("status")).toHaveTextContent(/Available for category budgets:.*29,000\.00/);

    const amountInput = within(dialog).getByLabelText("Limit");
    await user.type(amountInput, "30000");
    expect(within(dialog).getByRole("button", { name: "Add budget" })).toBeDisabled();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/exceeds the unspent amount remaining/);

    await user.clear(amountInput);
    await user.type(amountInput, "29000");
    expect(within(dialog).getByRole("button", { name: "Add budget" })).toBeEnabled();
  });

  it("subtracts existing category budgets from the unspent overall amount", async () => {
    const user = userEvent.setup();
    const { startDate, endDate } = currentMonthBounds();
    api.listBudgets.mockResolvedValue([
      {
        _id: "overall",
        categoryId: null,
        amountMinor: 5000000,
        currency: "NPR",
        periodType: "monthly",
        startDate,
        endDate,
        spentMinor: 2100000,
        remainingMinor: 2900000,
        percentageUsed: 42,
        status: "on_track",
      },
      {
        _id: "food",
        categoryId: "category-food",
        amountMinor: 1000000,
        currency: "NPR",
        periodType: "monthly",
        startDate,
        endDate,
        spentMinor: 0,
        remainingMinor: 1000000,
        percentageUsed: 0,
        status: "on_track",
      },
    ]);
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Create budget/ }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Budget scope Overall expenses/ }));
    await user.click(within(dialog).getByRole("menuitemradio", { name: /^One category/ }));
    await user.click(within(dialog).getByRole("button", { name: /Expense category Select category/ }));
    await user.click(within(dialog).getByRole("menuitemradio", { name: "Home" }));
    expect(await within(dialog).findByRole("status")).toHaveTextContent(/Available for category budgets:.*19,000\.00/);

    const amountInput = within(dialog).getByLabelText("Limit");
    await user.type(amountInput, "19000.01");
    expect(within(dialog).getByRole("button", { name: "Add budget" })).toBeDisabled();
    await user.clear(amountInput);
    await user.type(amountInput, "19000");
    expect(within(dialog).getByRole("button", { name: "Add budget" })).toBeEnabled();
  });
});
