import mongoose, { Schema, Document } from "mongoose";

const TranslationSchema = new Schema(
  {
    ar: { type: String, default: "" },
    de: { type: String, default: "" },
    en: { type: String, default: "" },
  },
  { _id: false }
);

export interface ICampaign extends Document {
  restaurantId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  segment?: "all" | "active" | "dormant";
  language: "all" | "ar" | "de" | "en";
  message: { ar: string; de: string; en: string };
  mediaUrl?: string;
  scheduledTime?: Date;
  status: "draft" | "sending" | "sent" | "scheduled";
  sentCount: number;
  failedCount: number;
  totalTarget: number;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    title: { type: String, required: true },
    description: String,
    segment: { type: String, enum: ["all", "active", "dormant"], default: "all" },
    language: { type: String, enum: ["all", "ar", "de", "en"], default: "all" },
    message: { type: TranslationSchema, required: true },
    mediaUrl: String,
    scheduledTime: Date,
    status: { type: String, enum: ["draft", "scheduled", "sending", "sent"], default: "draft" },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    totalTarget: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<ICampaign>("Campaign", CampaignSchema);
