import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "../src/pages/DashboardPage.jsx";

const api = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  listAllCategories: vi.fn(),
  listTransactions: vi.fn(),
  fetchReport: vi.fn(),
}));

vi.mock("../src/api/request.js", () => ({ apiRequest: api.apiRequest }));
vi.mock("../src/features/categories/categoriesApi.js", () => ({
  listAllCategories: api.listAllCategories,
}));
vi.mock("../src/features/expenses/transactionsApi.js", () => ({
  listTransactions: api.listTransactions,
}));
vi.mock("../src/features/reports/reportsApi.js", () => ({
  fetchReport: api.fetchReport,
}));
vi.mock("../src/pages/DashboardCharts.jsx", () => ({
  CashFlowChart: () => null,
  CategoryDoughnut: () => null,
}));

const categories = [
  { _id: "food-id", name: "Food", type: "expense", color: "#f59e0b" },
  { _id: "rent-id", name: "Rent", type: "expense", color: "#6366f1" },
  { _id: "shopping-id", name: "Shopping", type: "expense", color: "#14b8a6" },
  { _id: "travel-id", name: "Travel", type: "expense", color: "#8b5cf6" },
  { _id: "utilities-id", name: "Utilities", type: "expense", color: "#f97316" },
  { _id: "health-id", name: "Health", type: "expense", color: "#ef4444" },
  { _id: "miscellaneous-id", name: "Miscellaneous", type: "expense", color: "#64748b" },
  { _id: "salary-id", name: "Salary", type: "income", color: "#10b981" },
];

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  api.apiRequest.mockResolvedValue({ success: true });
  api.listAllCategories.mockResolvedValue(categories);
  api.listTransactions.mockResolvedValue({ data: [], pagination: { page: 1, totalPages: 1 } });
  api.fetchReport.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Quick Add category dropdown", () => {
  it("shows a styled menu, filters by transaction type, and submits the selected category", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Category Select category" }));
    const menu = screen.getByRole("menu");
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveClass("fixed", "overflow-y-auto");
    const foodOption = within(menu).getByRole("menuitemradio", { name: "Food" });
    expect(within(menu).getByRole("menuitemradio", { name: "Shopping" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: "Miscellaneous" })).toBeInTheDocument();
    expect(foodOption).toHaveAttribute("aria-checked", "false");
    expect(within(menu).queryByRole("menuitemradio", { name: "Salary" })).not.toBeInTheDocument();

    await user.click(within(menu).getByRole("menuitemradio", { name: "Shopping" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByText("Shopping")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Amount"), "12.50");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    expect(api.apiRequest).toHaveBeenCalledWith("/transactions", {
      method: "POST",
      body: expect.objectContaining({ categoryId: "shopping-id", type: "expense" }),
    });
  });

  it("shows all payment methods in a viewport-positioned menu", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Payment method Other" }));
    const menu = screen.getByRole("menu");
    expect(menu.parentElement).toBe(document.body);
    for (const method of ["Other", "Cash", "Card", "Bank transfer", "Mobile wallet"]) {
      expect(within(menu).getByRole("menuitemradio", { name: method })).toBeInTheDocument();
    }

    await user.click(within(menu).getByRole("menuitemradio", { name: "Card" }));
    expect(screen.getByRole("button", { name: "Payment method Card" })).toBeInTheDocument();
  });

  it("shows income categories after switching transaction type without asking to create one", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Type Expense" }));
    await user.click(within(screen.getByRole("menu")).getByRole("menuitemradio", { name: "Income" }));

    await user.click(screen.getByRole("button", { name: "Category Select category" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitemradio", { name: "Salary" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitemradio", { name: "Shopping" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Create a income category/)).not.toBeInTheDocument();
  });

  it("refreshes categories from Overview when a newly created expense category is missing", async () => {
    const user = userEvent.setup();
    api.listAllCategories
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(categories);
    renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Refresh categories" }));
    await user.click(await screen.findByRole("button", { name: "Category Select category" }));

    expect(within(screen.getByRole("menu")).getByRole("menuitemradio", { name: "Shopping" }))
      .toBeInTheDocument();
  });
});
