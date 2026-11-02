import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TransactionsPage from "../src/features/expenses/TransactionsPage.jsx";

const api = vi.hoisted(() => ({
  listCategories: vi.fn(),
  listTransactions: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));

vi.mock("../src/features/categories/categoriesApi.js", () => ({
  listCategories: api.listCategories,
}));

vi.mock("../src/features/expenses/transactionsApi.js", () => ({
  listTransactions: api.listTransactions,
  createTransaction: api.createTransaction,
  updateTransaction: api.updateTransaction,
  deleteTransaction: api.deleteTransaction,
}));

const expenseNames = ["Food", "Rent", "Entertainment", "Education", "Miscellaneous"];
const categories = expenseNames.map((name, index) => ({
  _id: `category-${index}`,
  name,
  type: "expense",
  color: "#f59e0b",
})).concat({ _id: "salary-id", name: "Salary", type: "income", color: "#10b981" });
const transaction = {
  _id: "transaction-1",
  categoryId: categories[0],
  type: "expense",
  amountMinor: 1250,
  currency: "NPR",
  date: "2026-03-10T12:00:00.000Z",
  note: "Lunch",
  paymentMethod: "cash",
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TransactionsPage />
    </QueryClientProvider>,
  );
}

async function expectExpenseOptions(user, dialog) {
  await user.click(within(dialog).getByRole("button", { name: /^Category / }));
  const menu = within(dialog).getByRole("menu");
  expect(within(menu).getAllByRole("menuitemradio").map((option) => option.getAttribute("aria-label")))
    .toEqual(expenseNames);
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
  api.listCategories.mockResolvedValue(categories);
  api.listTransactions.mockResolvedValue({ data: [transaction], pagination: { page: 1, totalPages: 1 } });
  api.createTransaction.mockResolvedValue(transaction);
  api.updateTransaction.mockResolvedValue(transaction);
  api.deleteTransaction.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("predefined expense transaction categories", () => {
  it("offers all predefined categories in both create and edit forms", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /add transaction/i }));
    const dialog = screen.getByRole("dialog");
    await expectExpenseOptions(user, dialog);
    await user.click(within(dialog).getByRole("menuitemradio", { name: "Food" }));
    expect(within(dialog).getByRole("button", { name: "Category Food" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Type Expense" }));
    const typeMenu = within(dialog).getByRole("menu");
    await user.click(within(typeMenu).getByRole("menuitemradio", { name: "Income" }));
    expect(within(dialog).getByRole("button", { name: "Type Income" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Category Select category" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Category Select category" }));
    expect(within(dialog).getByRole("menuitemradio", { name: "Salary" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(await screen.findByRole("button", { name: "Edit Lunch" }));
    const editDialog = screen.getByRole("dialog");
    await expectExpenseOptions(user, editDialog);
    expect(within(editDialog).getByRole("button", { name: "Category Food" })).toBeInTheDocument();
  });

  it("uses styled dropdown menus for transaction history type and category filters", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Type All" }));
    const typeMenu = screen.getByRole("menu");
    expect(within(typeMenu).getByRole("menuitemradio", { name: "Income" })).toBeInTheDocument();
    await user.click(within(typeMenu).getByRole("menuitemradio", { name: "Income" }));
    expect(screen.getByRole("button", { name: "Type Income" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Category All" }));
    const categoryMenu = screen.getByRole("menu");
    expect(within(categoryMenu).getByRole("menuitemradio", { name: "Food" })).toBeInTheDocument();
    expect(within(categoryMenu).getByRole("menuitemradio", { name: "Salary" })).toBeInTheDocument();
  });
});
