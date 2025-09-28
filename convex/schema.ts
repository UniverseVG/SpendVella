import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    tokenIdentifier: v.string(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .searchIndex("search_name", { searchField: "name" })
    .searchIndex("search_email", { searchField: "email" }),

  expenses: defineTable({
    description: v.string(),
    amount: v.number(),
    category: v.optional(v.string()),
    date: v.number(), // timestamp
    paidByUserId: v.id("users"), // references to users table
    splitType: v.string(), // "equal" , "percentage","exact"
    splits: v.array(
      v.object({
        userId: v.id("users"), // references to users table
        amount: v.number(), // amount owned by this user
        paid: v.boolean(), // whether this user has paid
      })
    ),
    groupId: v.optional(v.id("groups")), // undefined for one to one expenses
    createdBy: v.id("users"), // references to users table
  })
    .index("by_group", ["groupId"])
    .index("by_user_and_group", ["paidByUserId", "groupId"])
    .index("by_date", ["date"]),

  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"), // references to users table
    members: v.array(
      v.object({
        userId: v.id("users"), // references to users table
        role: v.string(), // "admin" or "member"
        joinedAt: v.number(), // timestamp
      })
    ), // references to users table
  })
    .index("by_created_by", ["createdBy"])
    .index("by_member", ["members"]),

  settlements: defineTable({
    amount: v.number(), // amount settled
    note: v.optional(v.string()),
    date: v.number(), // timestamp
    paidByUserId: v.id("users"), // references to users table
    receivedByUserId: v.id("users"), // references to users table
    groupId: v.optional(v.id("groups")), // undefined for one-on-one settlements
    relatedExpenseIds: v.optional(v.array(v.id("expenses"))), // which expense this settlement covers
    createdBy: v.id("users"), // timestamp
  })
    .index("by_group", ["groupId"])
    .index("by_user_and_group", ["paidByUserId", "groupId"])
    .index("by_receiver_and_group", ["receivedByUserId", "groupId"])
    .index("by_date", ["date"]),
});
