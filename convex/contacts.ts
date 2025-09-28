/* eslint-disable @typescript-eslint/ban-ts-comment */

import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { GroupType, UserType } from "../types";

type UserDoc = {
  _id: Id<"users">;
  name: string;
  email: string;
  imageUrl?: string;
};

type UserResponse = UserType & {
  type: string;
};

type GroupMember = {
  userId: Id<"users">;
  role: "admin" | "member";
  joinedAt: number;
};

type Group = {
  _id: Id<"groups">;
  name: string;
  description: string;
  createdBy: Id<"users">;
  members: GroupMember[];
};

type GroupResponse = GroupType & {
  type: string;
};

export const getAllContacts = query({
  handler: async (
    ctx
  ): Promise<{
    users: Array<UserResponse>;
    groups: Array<GroupResponse>;
  }> => {
    // Step 1: Get current user
    // @ts-ignore
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    if (
      !currentUser ||
      typeof currentUser !== "object" ||
      typeof currentUser._id !== "string"
    ) {
      throw new Error("Invalid current user");
    }

    // Step 2: Query personal expenses paid by current user
    const expensesYouPaid = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) =>
        q.eq("paidByUserId", currentUser._id).eq("groupId", undefined)
      )
      .collect();

    // Step 3: Query personal expenses user is involved in but didn't pay
    const expensesNotPaidByYou = (
      await ctx.db
        .query("expenses")
        .withIndex("by_group", (q) => q.eq("groupId", undefined))
        .collect()
    ).filter(
      (e) =>
        e.paidByUserId !== currentUser._id &&
        Array.isArray(e.splits) &&
        e.splits.some((s) => s.userId === currentUser._id)
    );

    // Step 4: Combine personal expenses
    const personalExpenses = [...expensesYouPaid, ...expensesNotPaidByYou];

    // Step 5: Collect unique user IDs
    const contactIds = new Set<Id<"users">>();

    personalExpenses.forEach((exp) => {
      if (
        typeof exp.paidByUserId === "string" &&
        exp.paidByUserId !== currentUser._id
      ) {
        contactIds.add(exp.paidByUserId);
      }
      if (Array.isArray(exp.splits)) {
        exp.splits.forEach((s) => {
          if (s.userId !== currentUser._id) {
            contactIds.add(s.userId);
          }
        });
      }
    });

    contactIds.delete(currentUser._id);

    // Step 6: Fetch users for contactIds with type checks
    const contactUsers: Array<UserResponse | null> = await Promise.all(
      [...contactIds].map(async (id) => {
        const u = (await ctx.db.get(id)) as UserDoc | null;
        if (u && typeof u.name === "string" && typeof u.email === "string") {
          return {
            id: u._id,
            name: u.name,
            email: u.email,
            imageUrl: u.imageUrl,
            type: "user",
          };
        }
        return null;
      })
    );

    // Step 7: Fetch groups where current user is member, with type checks
    const allGroups = await ctx.db.query("groups").collect();

    const userGroups = allGroups
      .filter(
        (g) =>
          g &&
          typeof g === "object" &&
          Array.isArray(g.members) &&
          g.members.some((m) => m.userId === currentUser._id)
      )
      .map((g) => ({
        id: g._id,
        name: g.name,
        description: typeof g.description === "string" ? g.description : "",
        memberCount: g.members.length,
        type: "group",
      }));

    // Step 8: Sort alphabetically by name
    contactUsers.sort((a, b) => (a?.name ?? "").localeCompare(b?.name ?? ""));
    userGroups.sort((a, b) => a.name.localeCompare(b.name));

    // Step 9: Return filtered results
    return {
      users: contactUsers.filter((u): u is NonNullable<typeof u> => u !== null),
      groups: userGroups,
    };
  },
});

// Implementation for creating a group

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    members: v.array(v.id("users")),
  },
  handler: async (ctx, args): Promise<Group> => {
    if (!args.name || typeof args.name !== "string" || !args.name.trim()) {
      throw new Error("Group name cannot be empty");
    }

    // @ts-ignore
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    if (
      !currentUser ||
      typeof currentUser !== "object" ||
      typeof currentUser._id !== "string"
    ) {
      throw new Error("Invalid current user");
    }

    const uniqueMembers = new Set<Id<"users">>(args.members);
    uniqueMembers.add(currentUser._id);

    for (const id of uniqueMembers) {
      const user = await ctx.db.get(id);
      if (
        !user ||
        typeof user !== "object" ||
        typeof user.name !== "string" ||
        typeof user.email !== "string"
      ) {
        throw new Error(`User with ID ${id} does not exist or is invalid`);
      }
    }
    const groupId = await ctx.db.insert("groups", {
      name: args.name.trim(),
      description: args.description?.trim() ?? "",
      createdBy: currentUser._id,
      members: [...uniqueMembers].map((id) => ({
        userId: id,
        role: id === currentUser._id ? "admin" : "member",
        joinedAt: Date.now(),
      })),
    });

    const createdGroup = await ctx.db.get(groupId);
    if (!createdGroup) {
      throw new Error("Failed to fetch the created group");
    }
    return createdGroup as Group;
  },
});
