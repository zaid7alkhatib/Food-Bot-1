import mongoose, { Schema, Document } from "mongoose";

export interface IWhatsAppSession extends Document {
  branchId: mongoose.Types.ObjectId;
  sessionName: string;
  qrCode?: string;
  qrStatus: "pending" | "scanned" | "connected" | "error";
  connected: boolean;
  lastConnectedAt?: Date;
  lastDisconnectedAt?: Date;
  authStatePath?: string;
  phoneNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppSessionSchema = new Schema<IWhatsAppSession>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    sessionName: { type: String, required: true },
    qrCode: String,
    qrStatus: { type: String, enum: ["pending", "scanned", "connected", "error"], default: "pending" },
    connected: { type: Boolean, default: false },
    lastConnectedAt: Date,
    lastDisconnectedAt: Date,
    authStatePath: String,
    phoneNumber: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IWhatsAppSession>("WhatsAppSession", WhatsAppSessionSchema);
