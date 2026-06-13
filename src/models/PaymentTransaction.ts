import mongoose, { Schema, Document } from "mongoose";

export interface IPaymentTransaction extends Document {
  paymentId?: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  provider: string;
  eventType: string;
  externalId?: string;
  payload: any;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    provider: { type: String, required: true, default: "Stripe" },
    eventType: { type: String, required: true },
    externalId: String,
    payload: { type: Schema.Types.Mixed },
    status: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IPaymentTransaction>("PaymentTransaction", PaymentTransactionSchema);
