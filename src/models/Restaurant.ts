import mongoose, { Schema, Document } from "mongoose";

export interface IRestaurant extends Document {
  name: string;
  legalName?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
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
  orderPrefix?: string;
  heroTagline?: { ar: string; de: string; en: string };
  heroBannerImage?: string;
  aboutText?: { ar: string; de: string; en: string };
  socialInstagram?: string;
  socialFacebook?: string;
  socialTikTok?: string;
  geminiEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema = new Schema<IRestaurant>(
  {
    name: { type: String, required: true },
    legalName: String,
    logo: String,
    primaryColor: { type: String, default: "#ea580c" },
    secondaryColor: { type: String, default: "#1f2937" },
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
    orderPrefix: { type: String, default: "TAB" },
    heroTagline: {
      ar: { type: String, default: "أشهى المأكولات الشامية" },
      de: { type: String, default: "Feine syrische Küche" },
      en: { type: String, default: "Delicious Syrian Cuisine" }
    },
    heroBannerImage: { type: String, default: "https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&auto=format&fit=crop&q=80" },
    aboutText: {
      ar: { type: String, default: "نقدم لكم عراقة الطعم الشامي الأصيل بمكونات طازجة وجودة عالية." },
      de: { type: String, default: "Wir bringen Ihnen den traditionellen Geschmack Syriens mit frischen Zutaten." },
      en: { type: String, default: "We bring you the authentic taste of Syrian cuisine crafted with fresh ingredients." }
    },
    socialInstagram: { type: String, default: "" },
    socialFacebook: { type: String, default: "" },
    socialTikTok: { type: String, default: "" },
    geminiEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IRestaurant>("Restaurant", RestaurantSchema);
