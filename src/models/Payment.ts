import mongoose, { Schema, Document } from "mongoose";

export interface IPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  restaurantId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  provider: "Stripe" | "Cash" | "Card" | "PayPal" | "Other";
  status: "pending" | "completed" | "failed" | "refunded";
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    amount: { type: Number, required: true },
    currency: { type: String, default: "EUR" },
    provider: {
      type: String,
      enum: ["Stripe", "Cash", "Card", "PayPal", "Other"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    transactionId: String,
  },
  { timestamps: true }
);

export default mongoose.model<IPayment>("Payment", PaymentSchema);
