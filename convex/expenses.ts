/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

type GetExpensesBetweenUsersResponse = {
  expenses: Doc<"expenses">[];
  settlements: Doc<"settlements">[];
  otherUser: {
    id: Id<"users">;
    name: string;
    email: string;
    imageUrl?: string;
  };
  balance: number;
};

// Create a new expense
export const createExpense = mutation({
  args: {
    description: v.string(),
    amount: v.number(),
    category: v.optional(v.string()),
    date: v.number(), // timestamp
    paidByUserId: v.id("users"),
    splitType: v.string(), // "equal", "percentage", "exact"
    splits: v.array(
      v.object({
        userId: v.id("users"),
        amount: v.number(),
        paid: v.boolean(),
      })
    ),
    groupId: v.optional(v.id("groups")),
  },
  handler: async (ctx, args) : Promise<Id<"expenses">> => {
    // Use centralized getCurrentUser function
    // @ts-ignore
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    // If there's a group, verify the user is a member
    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (!group) {
        throw new Error("Group not found");
      }

      const isMember = group.members.some(
        (member) => member.userId === user._id
      );
      if (!isMember) {
        throw new Error("You are not a member of this group");
      }
    }

    // Verify that splits add up to the total amount (with small tolerance for floating point issues)
    const totalSplitAmount = args.splits.reduce(
      (sum, split) => sum + split.amount,
      0
    );
    const tolerance = 0.01; // Allow for small rounding errors
    if (Math.abs(totalSplitAmount - args.amount) > tolerance) {
      throw new Error("Split amounts must add up to the total expense amount");
    }

    // Create the expense
    const expenseId = await ctx.db.insert("expenses", {
      description: args.description,
      amount: args.amount,
      category: args.category || "Other",
      date: args.date,
      paidByUserId: args.paidByUserId,
      splitType: args.splitType,
      splits: args.splits,
      groupId: args.groupId,
      createdBy: user._id,
    });

    return expenseId;
  },
});

export const getExpensesBetweenUsers = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    { userId }
  ): Promise<GetExpensesBetweenUsersResponse> => {
    //@ts-ignore
    const me = await ctx.runQuery(internal.users.getCurrentUser);
    if (me._id === userId) throw new Error("Cannot query yourself");

    /* ---- 1. One-on-One expenses where either user is the payer   ---*/
    const myPaid = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) =>
        q.eq("paidByUserId", me._id).eq("groupId", undefined)
      )
      .collect();

    const theirPaid = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) =>
        q.eq("paidByUserId", userId).eq("groupId", undefined)
      )
      .collect();

    const candidateExpenses = [...myPaid, ...theirPaid];

    /* ---- 2. Keep only rows where Both are involved  ---*/

    const expenses = candidateExpenses.filter((expense) => {
      const meInSplits = expense.splits.some(
        (split) => split.userId === me._id
      );
      const theirInSplits = expense.splits.some(
        (split) => split.userId === userId
      );

      const meInvolved = expense.paidByUserId === me._id || meInSplits;
      const theirInvolved = expense.paidByUserId === userId || theirInSplits;

      return meInvolved && theirInvolved;
    });

    expenses.sort((a, b) => b.date - a.date);

    /* ---- 3. Settlements between the two users where groupId is undefined ---*/

    const settlements = await ctx.db
      .query("settlements")
      .filter((q) =>
        q.and(
          q.eq(q.field("groupId"), undefined),
          q.or(
            q.and(
              q.eq(q.field("paidByUserId"), me._id),
              q.eq(q.field("receivedByUserId"), userId)
            ),
            q.and(
              q.eq(q.field("paidByUserId"), userId),
              q.eq(q.field("receivedByUserId"), me._id)
            )
          )
        )
      )
      .collect();

    settlements.sort((a, b) => b.date - a.date);

    /* ---- 4. Compute running balance ---*/
    let balance = 0;

    for (const e of expenses) {
      if (e.paidByUserId === me._id) {
        const split = e.splits.find((s: any) => s.userId === userId && !s.paid);
        if (split) {
          balance += split.amount; // they owe me
        }
      } else {
        const split = e.splits.find((s: any) => s.userId === me._id && !s.paid);
        if (split) {
          balance -= split.amount; // I owe them
        }
      }
    }

    for (const s of settlements) {
      if (s.paidByUserId === me._id) {
        balance += s.amount; // I paid them back
      } else {
        balance -= s.amount; // they paid me back
      }
    }

    /* ---- 5. Return the payload ---*/
    const otherUser = await ctx.db.get(userId);
    if (!otherUser) throw new Error("User not found");

    return {
      expenses,
      settlements,
      otherUser: {
        id: otherUser._id,
        name: otherUser.name,
        email: otherUser.email,
        imageUrl: otherUser.imageUrl,
      },
      balance,
    };
  },
});

export const deleteExpense = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    // @ts-ignore
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found");

    // Check if user is authorized to delete the expense
    // only the creator of the expense or the payer can delete it
    if (expense.createdBy !== user._id && expense.paidByUserId !== user._id) {
      throw new Error("You are not authorized to delete this expense");
    }

    await ctx.db.delete(args.expenseId);
    return { success: true };
  },
});
