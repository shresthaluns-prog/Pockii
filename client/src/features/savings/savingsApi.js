import { apiRequest } from "../../api/request.js";

export async function fetchSavingsBalance() {
  const result = await apiRequest("/savings");
  return result.data;
}

export async function saveSavingsBalance(values) {
  const result = await apiRequest("/savings", { method: "PUT", body: values });
  return result.data;
}
