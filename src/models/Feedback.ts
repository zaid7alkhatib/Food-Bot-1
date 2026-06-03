import mongoose, { Schema, Document } from "mongoose";

export interface IFeedback extends Document {
  orderId: string;
  restaurantId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  customerName: string;
  whatsAppPhone?: string;
  rating: number;
  comment?: string;
  status: "pending" | "resolved";
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    orderId: { type: String, required: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    customerName: { type: String, required: true },
    whatsAppPhone: String,
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: String,
    status: { type: String, enum: ["pending", "resolved"], default: "pending" },
    sentAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model<IFeedback>("Feedback", FeedbackSchema);
