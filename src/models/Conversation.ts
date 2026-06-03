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
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    customerName: { type: String, required: true },
    whatsAppPhone: { type: String, required: true, unique: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    botEnabled: { type: Boolean, default: true },
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
