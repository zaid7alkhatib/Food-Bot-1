import mongoose, { Schema, Document } from "mongoose";

const MessageSchema = new Schema(
  {
    id: { type: String, required: true },
    sender: { type: String, enum: ["customer", "bot", "human"], required: true },
    text: { type: String, required: true },
    timestamp: { type: String, required: true },
  },
  { _id: false }
);

const UnsubmittedOrderItemSchema = new Schema(
  {
    itemId: String,
    name: { ar: String, de: String, en: String },
    basePrice: Number,
    quantity: Number,
    selectedModifiers: [],
    selectedUpsell: { id: String, name: { ar: String, de: String, en: String }, price: Number },
    pendingUpsell: { id: String, name: { ar: String, de: String, en: String }, price: Number },
    totalPrice: Number,
  },
  { _id: false }
);

const UnsubmittedOrderSchema = new Schema(
  {
    branchId: String,
    customerName: String,
    whatsAppPhone: String,
    orderType: String,
    items: [UnsubmittedOrderItemSchema],
    subtotal: Number,
    deliveryFee: Number,
    total: Number,
    status: String,
    paymentMethod: String,
    deliveryAddress: String,
    pickupTime: String,
    notes: String,
  },
  { _id: false }
);

export interface IConversation extends Document {
  customerName: string;
  whatsAppPhone: string;
  whatsAppJid?: string;
  whatsAppPhoneJid?: string;
  whatsAppLid?: string;
  customerLanguage?: "ar" | "de" | "en" | "tr";
  restaurantId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  botEnabled: boolean;
  assignedTo?: string;
  takeoverReason?: string;
  takeoverStartedAt?: Date;
  takeoverEndedAt?: Date;
  messages: any[];
  currentStep?: string;
  unsubmittedOrder?: any;
  marketingOptIn?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    customerName: { type: String, required: true },
    whatsAppPhone: { type: String, required: true, unique: true },
    whatsAppJid: String,
    whatsAppPhoneJid: String,
    whatsAppLid: String,
    customerLanguage: { type: String, enum: ["ar", "de", "en", "tr"] },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    botEnabled: { type: Boolean, default: true },
    marketingOptIn: { type: Boolean, default: false },
    assignedTo: String,
    takeoverReason: String,
    takeoverStartedAt: Date,
    takeoverEndedAt: Date,
    messages: [MessageSchema],
    currentStep: { type: String, default: "welcome" },
    unsubmittedOrder: UnsubmittedOrderSchema,
  },
  { timestamps: true }
);

export default mongoose.model<IConversation>("Conversation", ConversationSchema);
