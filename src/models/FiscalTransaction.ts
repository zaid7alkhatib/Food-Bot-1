import mongoose, { Schema, Document } from "mongoose";

export interface IFiscalTransaction extends Document {
  orderId: mongoose.Types.ObjectId;
  transactionNumber: number;
  signature: string;
  signatureCounter: number;
  tseSerialNumber: string;
  processType: string;
  processData: string;
  startedAt: Date;
  completedAt: Date;
  clientAppId: string;
  createdAt: Date;
  updatedAt: Date;
}

const FiscalTransactionSchema = new Schema<IFiscalTransaction>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    transactionNumber: { type: Number, required: true },
    signature: { type: String, required: true },
    signatureCounter: { type: Number, required: true },
    tseSerialNumber: { type: String, required: true },
    processType: { type: String, required: true },
    processData: { type: String, required: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, required: true },
    clientAppId: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IFiscalTransaction>("FiscalTransaction", FiscalTransactionSchema);
