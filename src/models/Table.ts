import mongoose, { Schema, Document } from "mongoose";

export interface ITable extends Document {
  branchId: mongoose.Types.ObjectId;
  number: string;
  capacity: number;
  shape: "square" | "round" | "rectangle";
  posX: number;
  posY: number;
  section: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<ITable>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    number: { type: String, required: true },
    capacity: { type: Number, required: true, default: 4 },
    shape: { type: String, enum: ["square", "round", "rectangle"], default: "square" },
    posX: { type: Number, required: true, default: 10 },
    posY: { type: Number, required: true, default: 10 },
    section: { type: String, default: "Main Hall" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<ITable>("Table", TableSchema);
