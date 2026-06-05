import mongoose, { Schema, Document } from "mongoose";

const TranslationSchema = new Schema(
  {
    ar: { type: String, default: "" },
    de: { type: String, default: "" },
    en: { type: String, default: "" },
  },
  { _id: false }
);

const MenuBoardLayoutSchema = new Schema(
  {
    screenId: { type: String, required: true },
    name: { type: String, default: "" },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    orientation: { type: String, enum: ["landscape", "portrait"], default: "landscape" },
    template: { type: String, enum: ["grid", "split", "highlights"], default: "grid" },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const MenuBoardPromoSlideSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: TranslationSchema, default: () => ({ ar: "", de: "", en: "" }) },
    imageUrl: { type: String, default: "" },
    priceText: { type: TranslationSchema, default: () => ({ ar: "", de: "", en: "" }) },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    screenIds: [{ type: String }],
  },
  { _id: false }
);

const MenuBoardSettingsSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    languageMode: { type: String, enum: ["fixed", "rotate", "bilingual"], default: "rotate" },
    fixedLanguage: { type: String, enum: ["ar", "de", "en"], default: "de" },
    rotationSeconds: { type: Number, default: 15 },
    tickerEnabled: { type: Boolean, default: false },
    tickerText: { type: TranslationSchema, default: () => ({ ar: "", de: "", en: "" }) },
    layouts: { type: [MenuBoardLayoutSchema], default: [] },
    promoSlides: { type: [MenuBoardPromoSlideSchema], default: [] },
  },
  { _id: false }
);

export interface IBranch extends Document {
  restaurantId: mongoose.Types.ObjectId;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  phone: string;
  whatsappSessionId?: string;
  openingHours: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryRadiusKm: number;
  deliveryFee: number;
  minOrderAmount: number;
  printerSettings?: any;
  menuBoardSettings?: {
    enabled?: boolean;
    languageMode?: "fixed" | "rotate" | "bilingual";
    fixedLanguage?: "ar" | "de" | "en";
    rotationSeconds?: number;
    tickerEnabled?: boolean;
    tickerText?: { ar: string; de: string; en: string };
    layouts?: {
      screenId: string;
      name?: string;
      categoryIds?: mongoose.Types.ObjectId[];
      orientation?: "landscape" | "portrait";
      template?: "grid" | "split" | "highlights";
      isActive?: boolean;
    }[];
    promoSlides?: {
      id: string;
      title?: { ar: string; de: string; en: string };
      imageUrl?: string;
      priceText?: { ar: string; de: string; en: string };
      isActive?: boolean;
      sortOrder?: number;
      screenIds?: string[];
    }[];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    latitude: Number,
    longitude: Number,
    phone: { type: String, required: true },
    whatsappSessionId: String,
    openingHours: { type: String, default: "12:00 - 22:30" },
    pickupEnabled: { type: Boolean, default: true },
    deliveryEnabled: { type: Boolean, default: true },
    deliveryRadiusKm: { type: Number, default: 4 },
    deliveryFee: { type: Number, default: 1.5 },
    minOrderAmount: { type: Number, default: 10 },
    printerSettings: { type: Schema.Types.Mixed, default: {} },
    menuBoardSettings: { type: MenuBoardSettingsSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IBranch>("Branch", BranchSchema);
