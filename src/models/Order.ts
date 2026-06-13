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

export interface IOrderStatusHistory {
  from: string;
  to: string;
  by: string;
  timestamp: Date;
}

export interface IPaymentAudit {
  paymentProvider: string;
  paymentIntentId?: string;
  amount: number;
  currency: string;
  status: string;
  paidAt?: Date;
}

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
  paymentStatus: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  status: "received" | "under_review" | "accepted" | "preparing" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "cancelled";
  deliveryAddress?: string;
  pickupTime?: string;
  tableNumber?: string;
  scheduledTime?: string;
  notes?: string;
  feedbackRequested?: boolean;
  source: string;
  stripeSessionId?: string;
  paymentAudit?: IPaymentAudit;
  statusHistory: IOrderStatusHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAuditSchema = new Schema<IPaymentAudit>(
  {
    paymentProvider: { type: String, required: true },
    paymentIntentId: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: "EUR" },
    status: { type: String, required: true },
    paidAt: Date,
  },
  { _id: false }
);

const OrderStatusHistorySchema = new Schema<IOrderStatusHistory>(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    by: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

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
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "partially_refunded"],
      default: "pending",
    },
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
    stripeSessionId: String,
    paymentAudit: PaymentAuditSchema,
    statusHistory: { type: [OrderStatusHistorySchema], default: [] },
  },
  { timestamps: true }
);

// GoBD compliance: Post-initialization tracking of previous values
OrderSchema.post("init", function (doc) {
  (doc as any)._originalStatus = doc.status;
  (doc as any)._originalPaymentStatus = doc.paymentStatus;
});

// GoBD compliance: Restrict mutations to finalized states
OrderSchema.pre("save", function (next) {
  const self = this as any;
  if (self.isNew) {
    if (!self.statusHistory || self.statusHistory.length === 0) {
      self.statusHistory = [
        {
          from: "none",
          to: self.status,
          by: self.source || "customer",
          timestamp: new Date(),
        },
      ];
    }
  } else {
    // If status is modified, ensure we track history if not already updated manually
    if (self.isModified("status") && self._originalStatus !== self.status) {
      const FINAL_ORDER_STATUSES = ["delivered", "cancelled"];
      if (FINAL_ORDER_STATUSES.includes(self._originalStatus)) {
        return next(
          new Error(
            `Compliance violation: Cannot change status of a finalized order (${self._originalStatus} -> ${self.status}).`
          )
        );
      }
    }

    // If payment status is modified, restrict reverting final states
    if (self.isModified("paymentStatus") && self._originalPaymentStatus !== self.paymentStatus) {
      const FINAL_PAYMENT_STATUSES = ["paid", "refunded", "partially_refunded"];
      if (FINAL_PAYMENT_STATUSES.includes(self._originalPaymentStatus) && self.paymentStatus === "pending") {
        return next(
          new Error(
            `Compliance violation: Cannot revert a finalized payment status (${self._originalPaymentStatus} -> pending).`
          )
        );
      }
    }
  }
  next();
});

// GoBD compliance: Intercept and block deletes on finalized/paid orders
function blockFinalizedDeletes(this: any, next: any) {
  const doc = this;
  const FINAL_PAYMENT_STATUSES = ["paid", "refunded", "partially_refunded"];
  const FINAL_ORDER_STATUSES = ["delivered", "cancelled"];

  if (doc) {
    if (FINAL_PAYMENT_STATUSES.includes(doc.paymentStatus) || FINAL_ORDER_STATUSES.includes(doc.status)) {
      return next(
        new Error(
          "Compliance violation: Cannot delete finalized or paid orders (GoBD compliance rule)."
        )
      );
    }
  }
  next();
}

OrderSchema.pre("deleteOne", { document: true, query: false }, blockFinalizedDeletes);

export default mongoose.model<IOrder>("Order", OrderSchema);
