import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SavingsBalanceCard from "../src/features/savings/SavingsBalanceCard.jsx";

const api = vi.hoisted(() => ({
  fetchSavingsBalance: vi.fn(),
  saveSavingsBalance: vi.fn(),
}));

vi.mock("../src/features/savings/savingsApi.js", () => ({
  fetchSavingsBalance: api.fetchSavingsBalance,
  saveSavingsBalance: api.saveSavingsBalance,
}));

function renderCard(currency = "USD") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SavingsBalanceCard currency={currency} userId="user-1" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("savings balance card", () => {
  it("saves a balance in the selected report currency", async () => {
    const user = userEvent.setup();
    let saved = null;
    api.fetchSavingsBalance.mockImplementation(async () => saved);
    api.saveSavingsBalance.mockImplementation(async (values) => {
      saved = values;
      return values;
    });
    renderCard("USD");

    await user.type(await screen.findByLabelText("Balance in USD"), "123.45");
    await user.click(screen.getByRole("button", { name: "Save balance" }));

    expect(api.saveSavingsBalance.mock.calls[0][0]).toEqual({ amountMinor: 12345, currency: "USD" });
    expect(await screen.findByRole("status")).toHaveTextContent("Savings balance saved.");
  });

  it("allows saving a zero balance", async () => {
    const user = userEvent.setup();
    api.fetchSavingsBalance.mockResolvedValue(null);
    api.saveSavingsBalance.mockResolvedValue({ amountMinor: 0, currency: "NPR" });
    renderCard("NPR");

    await user.type(await screen.findByLabelText("Balance in NPR"), "0");
    await user.click(screen.getByRole("button", { name: "Save balance" }));

    expect(api.saveSavingsBalance.mock.calls[0][0]).toEqual({ amountMinor: 0, currency: "NPR" });
  });

  it("does not display a saved amount as if it were in a different selected currency", async () => {
    api.fetchSavingsBalance.mockResolvedValue({ amountMinor: 5000, currency: "USD" });
    renderCard("NPR");

    expect(await screen.findByText(/This balance is in USD/)).toBeInTheDocument();
    expect(screen.getByLabelText("Balance in NPR")).toHaveProperty("value", "");
  });
});
