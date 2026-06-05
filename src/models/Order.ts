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
    id: String,
    name: TranslationSchema,
    priceAdjustment: { type: Number, default: 0 },
  },
  { _id: false }
);

const SelectedModifierSchema = new Schema(
  {
    groupId: String,
    groupName: TranslationSchema,
    option: ModifierOptionSchema,
  },
  { _id: false }
);

const SelectedUpsellSchema = new Schema(
  {
    id: String,
    name: TranslationSchema,
    price: Number,
  },
  { _id: false }
);

const OrderItemSchema = new Schema(
  {
    itemId: { type: String, required: true },
    name: { type: TranslationSchema, required: true },
    basePrice: { type: Number, required: true },
    quantity: { type: Number, required: true },
    selectedModifiers: [SelectedModifierSchema],
    selectedUpsell: SelectedUpsellSchema,
    totalPrice: { type: Number, required: true },
  },
  { _id: false }
);

export interface IOrder extends Document {
  orderNumber: string;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  customerName: string;
  whatsAppPhone?: string;
  whatsAppJid?: string;
  whatsAppPhoneJid?: string;
  whatsAppLid?: string;
  orderType: "delivery" | "pickup" | "dine_in";
  items: any[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: "pending" | "paid" | "failed";
  status: "received" | "under_review" | "accepted" | "preparing" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "cancelled";
  deliveryAddress?: string;
  pickupTime?: string;
  tableNumber?: string;
  scheduledTime?: string;
  notes?: string;
  feedbackRequested?: boolean;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    customerName: { type: String, required: true },
    whatsAppPhone: { type: String, default: "" },
    whatsAppJid: String,
    whatsAppPhoneJid: String,
    whatsAppLid: String,
    orderType: { type: String, enum: ["delivery", "pickup", "dine_in"], required: true },
    items: [OrderItemSchema],
    subtotal: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: "EUR" },
    paymentMethod: { type: String, default: "Cash on Delivery" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    status: {
      type: String,
      enum: ["received", "under_review", "accepted", "preparing", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"],
      default: "received",
    },
    deliveryAddress: String,
    pickupTime: String,
    tableNumber: String,
    scheduledTime: String,
    notes: String,
    feedbackRequested: { type: Boolean, default: false },
    source: { type: String, default: "whatsapp" },
  },
  { timestamps: true }
);

export default mongoose.model<IOrder>("Order", OrderSchema);
