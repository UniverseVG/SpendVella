/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

export const getUserBalances = query({
  handler: async (ctx) => {
    // @ts-ignore
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    /* ----------- 1 to 1 expenses (not including groups or no groupId) ----------- */
    // Filter expenses to only include one-to-one expenses (not group expenses or no groupId)
    // where the current user is either the payer or in the splitWith array
    const expenses = (await ctx.db.query("expenses").collect()).filter(
      (e) =>
        !e.groupId && // 1 to 1 expenses only
        (e.paidByUserId === user._id ||
          e.splits.some((s) => s.userId === user._id))
    );

    let youOwe = 0; // Total amount the user owes to others
    let youAreOwed = 0; // Total amount others owe to the user
    const balanceByUser: Record<
      Id<"users">,
      { owed: number; owing: number }
    > = {}; // Detailed breakdown per user

    for (const e of expenses) {
      const isPayer = e.paidByUserId === user._id;
      const mySplit = e.splits.find((s) => s.userId === user._id);

      if (isPayer) {
        for (const s of e.splits) {
          // Skip user's own split or already paid splits
          if (s.userId === user._id || s.paid) continue;
          // Add to the amount others owe to the user
          youAreOwed += s.amount;

          (balanceByUser[s.userId] ??= {
            owed: 0,
            owing: 0,
          }).owed += s.amount;
        }
      } else if (mySplit && !mySplit.paid) {
        // Someone else paid, and the user hasn't paid their split
        youOwe += mySplit.amount;

        (balanceByUser[e.paidByUserId] ??= {
          owed: 0,
          owing: 0,
        }).owing += mySplit.amount;
      }
    }

    /* ------------------ 1 to 1 settlements (no groupId)------------------ */
    // Get settlements that directly involve the user
    const settlements = (await ctx.db.query("settlements").collect()).filter(
      (s) =>
        !s.groupId &&
        (s.paidByUserId === user._id || s.receivedByUserId === user._id)
    );

    for (const s of settlements) {
      if (s.paidByUserId === user._id) {
        // User paid someone else -> reduces what they owes
        youOwe -= s.amount;
        (balanceByUser[s.receivedByUserId] ??= {
          owed: 0,
          owing: 0,
        }).owing -= s.amount;
      } else {
        // Someone paid the user -> reduces what they are owed
        youAreOwed -= s.amount;
        (balanceByUser[s.paidByUserId] ??= {
          owed: 0,
          owing: 0,
        }).owed -= s.amount;
      }
    }

    /* build lists for UI */
    const youOweList = []; // List of users the current user owes money to
    const youAreOwedByList = []; // List of users who owe money to the current user

    for (const [uid, { owed, owing }] of Object.entries(balanceByUser)) {
      const net = owed - owing; // Calculate the net balance
      if (net === 0) continue; // Skip settled balances

      // Get user details
      const counterpart = await ctx.db.get(uid as Id<"users">);
      const base = {
        userId: uid,
        name: counterpart?.name || "Unknown",
        imageUrl: counterpart?.imageUrl || null,
        amount: Math.abs(net),
      };

      net > 0 ? youAreOwedByList.push(base) : youOweList.push(base);
    }

    // Sort lists by amount
    youOweList.sort((a, b) => b.amount - a.amount);
    youAreOwedByList.sort((a, b) => b.amount - a.amount);

    return {
      youOwe, // Total amount the user owes
      youAreOwed, // Total amount others owe the user
      totalBalance: youAreOwed - youOwe, // Net balance
      oweDetails: { youOwe: youOweList, youAreOwedBy: youAreOwedByList }, // Detailed lists
    };
  },
});

export const getTotalSpent = query({
  handler: async (ctx) => {
    // @ts-ignore
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime();

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_date", (q) => q.gte("date", startOfYear))
      .collect();

    // Filter expenses to only include those where the user is involved
    const userExpenses = expenses.filter(
      (expense) =>
        expense.paidByUserId === user._id ||
        expense.splits.some((s) => s.userId === user._id)
    );

    let totalSpent = 0;

    userExpenses.forEach((expense) => {
      const userSplit = expense.splits.find((s) => s.userId === user._id);
      if (userSplit) {
        totalSpent += userSplit.amount;
      }
    });
    return totalSpent;
  },
});

export const getMonthlySpending = query({
  handler: async (ctx) => {
    // @ts-ignore
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime();

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_date", (q) => q.gte("date", startOfYear))
      .collect();

    const userExpenses = expenses.filter(
      (expense) =>
        expense.paidByUserId === user._id ||
        expense.splits.some((s) => s.userId === user._id)
    );

    const monthlyTotals: Record<number, number> = {};

    for (let i = 0; i < 12; i++) {
      const monthlyDate = new Date(currentYear, i, 1);
      monthlyTotals[monthlyDate.getTime()] = 0;
    }

    userExpenses.forEach((expense) => {
      const date = new Date(expense.date);
      const monthStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        1
      ).getTime();

      const userSplit = expense.splits.find((s) => s.userId === user._id);
      if (userSplit) {
        monthlyTotals[monthStart] =
          (monthlyTotals[monthStart] || 0) + userSplit.amount;
      }
    });

    const result = Object.entries(monthlyTotals).map(([month, total]) => ({
      month: parseInt(month),
      total,
    }));

    // sort by month
    result.sort((a, b) => a.month - b.month);

    return result;
    // const monthlySpending = expenses.reduce(
    //   (acc, expense) => {
    //     const month = new Date(expense.date).getMonth();
    //     acc[month] = (acc[month] || 0) + expense.amount;
    //     return acc;
    //   },
    //   {} as Record<number, number>
    // );

    // return monthlySpending;
  },
});

export const getUserGroups = query({
  handler: async (ctx) => {
    // @ts-ignore
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    // get all groups from the db
    const allGroups = await ctx.db.query("groups").collect();

    // filter groups where the user is a member
    const userGroups = allGroups.filter((group) =>
      group.members.some((member) => member.userId === user._id)
    );

    const enhancedGroups: any = await Promise.all(
      userGroups.map(async (group) => {
        const expenses = await ctx.db
          .query("expenses")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();

        let balance = 0;

        expenses.forEach((expense) => {
          if (expense.paidByUserId === user._id) {
            expense.splits.forEach((split) => {
              if (split.userId !== user._id && !split.paid) {
                balance += split.amount;
              }
            });
          } else {
            const userSplit = expense.splits.find((s) => s.userId === user._id);
            if (userSplit && !userSplit.paid) {
              balance -= userSplit.amount;
            }
          }
        });

        // Apply Settlements to adjust the balance

        const settlements = await ctx.db
          .query("settlements")
          .filter((q) =>
            q.and(
              q.eq(q.field("groupId"), group._id),
              q.or(
                q.eq(q.field("paidByUserId"), user._id),
                q.eq(q.field("receivedByUserId"), user._id)
              )
            )
          )
          .collect();

        settlements.forEach((settlement) => {
          if (settlement.paidByUserId === user._id) {
            balance += settlement.amount;
          } else {
            balance -= settlement.amount;
          }
        });
        return {
          ...group,
          id: group._id,
          balance,
        };
      })
    );
    return enhancedGroups;
  },
});
