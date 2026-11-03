import { Router } from "express";
import Category from "../categories/category.model.js";
import Transaction from "../expenses/transaction.model.js";
import { requireAuthenticatedUser } from "../../middleware/requireAuthenticatedUser.js";
import Budget from "./budget.model.js";
import { getUtcBudgetPeriod } from "./budget-period.js";
import { createBudgetService } from "./budget.service.js";
import {
  budgetIdSchema,
  createBudgetSchema,
  listBudgetsSchema,
  updateBudgetSchema,
} from "./budget.schemas.js";

const budgetRouter = Router();
const budgetService = createBudgetService({ BudgetModel: Budget, TransactionModel: Transaction });
budgetRouter.use(requireAuthenticatedUser);

function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(source === "params" ? req.params.id : req[source]);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Request validation failed.",
        issues: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
      });
    }
    req.validated = { ...(req.validated ?? {}), [source]: result.data };
    next();
  };
}

async function validateCategory(userId, categoryId) {
  if (categoryId === null || categoryId === undefined) return true;
  return Boolean(await Category.exists({ _id: categoryId, userId, type: "expense", isArchived: false }));
}

function budgetPeriodFields(values) {
  const period = getUtcBudgetPeriod(values.periodType, values.startDate, values.endDate);
  return { periodType: values.periodType, ...period };
}

function createPayload(values, userId) {
  return {
    categoryId: values.categoryId ?? null,
    amountMinor: values.amountMinor,
    currency: values.currency,
    userId,
    ...budgetPeriodFields(values),
  };
}

async function findAllocationContext(userId, candidate, excludedBudgetId) {
  const matchingPeriod = {
    currency: candidate.currency,
    startDate: candidate.startDate,
    endDate: candidate.endDate,
  };
  const excluded = excludedBudgetId ? { _id: { $ne: excludedBudgetId } } : {};
  const [overallBudget, categoryBudgets] = await Promise.all([
    budgetService.withSpending(userId, {
      ...matchingPeriod,
      categoryId: null,
    }).then(([budget]) => budget ?? null),
    Budget.find({
      userId,
      ...matchingPeriod,
      categoryId: { $ne: null },
      ...excluded,
    }).select("amountMinor").lean(),
  ]);
  return { overallBudget, categoryBudgets };
}

function getAllocationError(candidate, { overallBudget, categoryBudgets }) {
  const allocatedMinor = categoryBudgets.reduce(
    (total, budget) => total + BigInt(budget.amountMinor),
    0n,
  );
  if (candidate.categoryId) {
    if (!overallBudget) {
      return "Create an overall budget for the same period and currency before adding category budgets.";
    }
    const remainingMinor = BigInt(overallBudget.remainingMinor);
    if (allocatedMinor + BigInt(candidate.amountMinor) > remainingMinor) {
      return "Category budgets cannot exceed the remaining overall budget for this period and currency.";
    }
  } else if (overallBudget) {
    const remainingMinor = BigInt(candidate.amountMinor) - BigInt(overallBudget.spentMinor);
    if (allocatedMinor > remainingMinor) {
      return "The remaining overall budget cannot be lower than the total of its category budgets.";
    }
  }
  return null;
}

budgetRouter
  .route("/")
  .get(validate(listBudgetsSchema, "query"), async (req, res, next) => {
    try {
      const { periodType, categoryId, scope, page, limit } = req.validated.query;
      const filter = {};
      if (periodType) filter.periodType = periodType;
      if (scope === "overall") filter.categoryId = null;
      else if (categoryId !== undefined) filter.categoryId = categoryId;
      const [budgets, total] = await Promise.all([
        budgetService.withSpending(req.authUser.id, filter, { page, limit }),
        Budget.countDocuments({ userId: req.authUser.id, ...filter }),
      ]);
      res.json({
        success: true,
        data: budgets,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      next(error);
    }
  })
  .post(validate(createBudgetSchema), async (req, res, next) => {
    try {
      const payload = createPayload(req.validated.body, req.authUser.id);
      if (!(await validateCategory(req.authUser.id, payload.categoryId))) {
        return res.status(404).json({ success: false, message: "Expense category not found." });
      }

      const allocationContext = await findAllocationContext(req.authUser.id, payload);
      const allocationError = getAllocationError(payload, allocationContext);
      if (allocationError) {
        return res.status(400).json({ success: false, message: allocationError });
      }

      const budget = await Budget.create(payload);
      const data = await budgetService.getById(req.authUser.id, budget._id);
      res.status(201).json({ success: true, data });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ success: false, message: "A budget already exists for this period and scope." });
      }
      if (error?.name === "ValidationError" || error?.name === "CastError") {
        return res.status(400).json({ success: false, message: "Budget validation failed." });
      }
      next(error);
    }
  });

budgetRouter
  .route("/:id")
  .all(validate(budgetIdSchema, "params"))
  .get(async (req, res, next) => {
    try {
      const budget = await budgetService.getById(req.authUser.id, req.validated.params);
      if (!budget) return res.status(404).json({ success: false, message: "Budget not found." });
      res.json({ success: true, data: budget });
    } catch (error) {
      next(error);
    }
  })
  .patch(validate(updateBudgetSchema), async (req, res, next) => {
    try {
      const existing = await Budget.findOne({
        _id: req.validated.params,
        userId: req.authUser.id,
      });
      if (!existing) return res.status(404).json({ success: false, message: "Budget not found." });

      const updates = req.validated.body;
      const categoryId =
        updates.categoryId !== undefined ? updates.categoryId : existing.categoryId?.toString() ?? null;
      if (!(await validateCategory(req.authUser.id, categoryId))) {
        return res.status(404).json({ success: false, message: "Expense category not found." });
      }

      const periodValues = {
        periodType: updates.periodType ?? existing.periodType,
        startDate: updates.startDate ?? existing.startDate.toISOString().slice(0, 10),
        endDate: updates.endDate ?? existing.endDate.toISOString().slice(0, 10),
      };
      if (periodValues.periodType !== "custom" && updates.endDate) {
        return res.status(400).json({
          success: false,
          message: "endDate cannot be set for weekly or monthly budget periods.",
        });
      }
      if (periodValues.periodType === "custom" && !updates.endDate && !updates.periodType && !updates.startDate) {
        periodValues.endDate = existing.endDate.toISOString().slice(0, 10);
      } else if (periodValues.periodType === "custom" && !updates.endDate) {
        return res.status(400).json({
          success: false,
          message: "endDate is required when changing a custom budget period.",
        });
      }

      const period = budgetPeriodFields(periodValues);
      const candidate = {
        categoryId,
        amountMinor: updates.amountMinor ?? existing.amountMinor,
        currency: updates.currency ?? existing.currency,
        ...period,
      };
      const allocationContext = await findAllocationContext(
        req.authUser.id,
        candidate,
        existing._id,
      );
      const allocationError = getAllocationError(candidate, allocationContext);
      if (allocationError) {
        return res.status(400).json({ success: false, message: allocationError });
      }

      Object.assign(existing, updates, { categoryId, ...period });
      await existing.save();
      res.json({ success: true, data: await budgetService.getById(req.authUser.id, existing._id) });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ success: false, message: "A budget already exists for this period and scope." });
      }
      if (error?.name === "ValidationError" || error?.name === "CastError" || error instanceof RangeError) {
        return res.status(400).json({ success: false, message: "Budget validation failed." });
      }
      next(error);
    }
  })
  .delete(async (req, res, next) => {
    try {
      const budget = await Budget.findOne({
        _id: req.validated.params,
        userId: req.authUser.id,
      });
      if (!budget) return res.status(404).json({ success: false, message: "Budget not found." });
      if (!budget.categoryId) {
        const allocationContext = await findAllocationContext(req.authUser.id, budget, budget._id);
        if (allocationContext.categoryBudgets.length > 0) {
          return res.status(409).json({
            success: false,
            message: "Delete this budget's category budgets before deleting the overall budget.",
          });
        }
      }
      await budget.deleteOne();
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

export default budgetRouter;
