import mongoose, { Schema, Document } from "mongoose";

export interface IRestaurant extends Document {
  name: string;
  legalName?: string;
  logo?: string;
  phone: string;
  whatsappNumber: string;
  email?: string;
  address?: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  defaultCurrency: string;
  timezone: string;
  isActive: boolean;
  googleMapsReviewLink?: string;
  taxVatRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema = new Schema<IRestaurant>(
  {
    name: { type: String, required: true },
    legalName: String,
    logo: String,
    phone: { type: String, required: true },
    whatsappNumber: { type: String, required: true },
    email: String,
    address: String,
    defaultLanguage: { type: String, default: "de" },
    supportedLanguages: { type: [String], default: ["ar", "de", "en"] },
    defaultCurrency: { type: String, default: "EUR" },
    timezone: { type: String, default: "Europe/Berlin" },
    isActive: { type: Boolean, default: true },
    googleMapsReviewLink: String,
    taxVatRate: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IRestaurant>("Restaurant", RestaurantSchema);
