/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { CreateEmailResponse, Resend } from "resend";

// Action to send email using Resend
export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const resend = new Resend(args.apiKey);

    try {
      const result: CreateEmailResponse = await resend.emails.send({
        from: "SpendVella <updates@updates.varungm.in>",
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      });

      return { success: true, id: result.data?.id };
    } catch (error: any) {
      console.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }
  },
});
