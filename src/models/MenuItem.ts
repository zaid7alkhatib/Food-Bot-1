import mongoose, { Schema, Document } from "mongoose";

const TranslationSchema = new Schema(
  {
    ar: { type: String, default: "" },
    de: { type: String, default: "" },
    en: { type: String, default: "" },
  },
  { _id: false }
);

const ModifierOptionSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: TranslationSchema, required: true },
    priceAdjustment: { type: Number, default: 0 },
  },
  { _id: false }
);

const ModifierGroupSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: TranslationSchema, required: true },
    type: { type: String, enum: ["single", "multiple"], default: "single" },
    isRequired: { type: Boolean, default: false },
    minSelections: { type: Number, default: 0 },
    maxSelections: { type: Number, default: 1 },
    options: [ModifierOptionSchema],
  },
  { _id: false }
);

const UpsellSuggestionSchema = new Schema(
  {
    id: { type: String, required: true },
    triggerCategoryId: String,
    triggerItemIds: [String],
    suggestedItemName: { type: TranslationSchema, required: true },
    suggestedItemId: String,
    price: { type: Number, required: true },
    description: TranslationSchema,
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

export interface IMenuItem extends Document {
  restaurantId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  name: { ar: string; de: string; en: string };
  description: { ar: string; de: string; en: string };
  basePrice: number;
  image?: string;
  skucode: string;
  preparationTimeMinutes: number;
  isAvailableForDelivery: boolean;
  isAvailableForPickup: boolean;
  isActive: boolean;
  isBestSeller: boolean;
  sortOrder: number;
  modifierGroups: any[];
  upsellSuggestions: any[];
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    name: { type: TranslationSchema, required: true },
    description: { type: TranslationSchema, required: true },
    basePrice: { type: Number, required: true },
    image: String,
    skucode: { type: String, required: true },
    preparationTimeMinutes: { type: Number, default: 10 },
    isAvailableForDelivery: { type: Boolean, default: true },
    isAvailableForPickup: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    isBestSeller: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    modifierGroups: [ModifierGroupSchema],
    upsellSuggestions: [UpsellSuggestionSchema],
  },
  { timestamps: true }
);

export default mongoose.model<IMenuItem>("MenuItem", MenuItemSchema);
