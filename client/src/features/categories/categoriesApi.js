import { apiRequest, queryString } from "../../api/request.js";

export async function listCategories(values = {}) {
  const result = await apiRequest(`/categories${queryString({ ...values, limit: 100 })}`);
  return result.data;
}

export async function listAllCategories(values = {}) {
  const firstPage = await apiRequest(`/categories${queryString({ ...values, page: 1, limit: 100 })}`);
  const categories = [...firstPage.data];
  for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
    const result = await apiRequest(`/categories${queryString({ ...values, page, limit: 100 })}`);
    categories.push(...result.data);
  }
  return categories;
}

export async function createCategory(values) {
  const result = await apiRequest("/categories", { method: "POST", body: values });
  return result.data;
}

export async function updateCategory(id, values) {
  const result = await apiRequest(`/categories/${id}`, { method: "PATCH", body: values });
  return result.data;
}

export function archiveCategory(id) {
  return apiRequest(`/categories/${id}`, { method: "DELETE" });
}

export function restoreCategory(id) {
  return apiRequest(`/categories/${id}/restore`, { method: "POST" });
}
