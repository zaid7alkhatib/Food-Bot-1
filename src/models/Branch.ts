import mongoose, { Schema, Document } from "mongoose";

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
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IBranch>("Branch", BranchSchema);
