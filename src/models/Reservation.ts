import mongoose, { Schema, Document } from "mongoose";

export interface IReservation extends Document {
  branchId: mongoose.Types.ObjectId;
  tableId?: mongoose.Types.ObjectId;
  customerName: string;
  whatsAppPhone: string;
  guestCount: number;
  dateTime: Date;
  durationMinutes: number;
  status: "pending" | "confirmed" | "seated" | "cancelled" | "completed";
  source: "website" | "whatsapp" | "dashboard";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    tableId: { type: Schema.Types.ObjectId, ref: "Table" },
    customerName: { type: String, required: true },
    whatsAppPhone: { type: String, required: true },
    guestCount: { type: Number, required: true, default: 2 },
    dateTime: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, default: 90 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "seated", "cancelled", "completed"],
      default: "pending",
    },
    source: {
      type: String,
      enum: ["website", "whatsapp", "dashboard"],
      default: "website",
    },
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model<IReservation>("Reservation", ReservationSchema);
