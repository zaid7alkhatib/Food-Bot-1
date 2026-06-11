import mongoose, { Schema, Document } from "mongoose";

const TranslationSchema = new Schema(
  {
    ar: { type: String, default: "" },
    de: { type: String, default: "" },
    en: { type: String, default: "" },
    tr: { type: String, default: "" },
  },
  { _id: false }
);

export interface ICategory extends Document {
  restaurantId: mongoose.Types.ObjectId;
  branchIds: mongoose.Types.ObjectId[];
  name: { ar: string; de: string; en: string; tr?: string };
  description?: { ar: string; de: string; en: string; tr?: string };
  sortOrder: number;
  image?: string;
  isActive: boolean;
  availableForDelivery: boolean;
  availableForPickup: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
    branchIds: [{ type: Schema.Types.ObjectId, ref: "Branch" }],
    name: { type: TranslationSchema, required: true },
    description: TranslationSchema,
    sortOrder: { type: Number, default: 0 },
    image: String,
    isActive: { type: Boolean, default: true },
    availableForDelivery: { type: Boolean, default: true },
    availableForPickup: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<ICategory>("Category", CategorySchema);
