import mongoose from "mongoose";
import { CADRES, DESIGNATIONS, DISTRICTS, FEE, STATUSES, UPI } from "../../shared/constants.js";

const values = (list) => list.map((x) => x.value);

// Participant login. One account registers one participant.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, required: true },
    passwordHash: { type: String, required: true },
    // Sessions issued before this are no longer accepted (set when the password is reset).
    passwordChangedAt: Date,
    reset: { tokenHash: String, expiresAt: Date },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);

const registrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    regNo: { type: String, required: true, unique: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    fullName: { type: String, required: true, trim: true },
    cadre: { type: String, required: true, enum: values(CADRES) },
    district: { type: String, required: true, enum: values(DISTRICTS) },
    institution: { type: String, required: true },
    designation: { type: String, required: true, enum: values(DESIGNATIONS) },
    designationOther: String,
    fieldOfStudy: { type: String, required: true },
    orgResponsibility: String,
    residentialAddress: { type: String, required: true },
    mobile: { type: String, required: true, index: true },
    altContact: String,

    amount: { type: Number, default: FEE },
    // The UPI reference (UTR) typed by the participant.
    utr: { type: String, required: true, unique: true },
    // Payment screenshot, shrunk before saving (see lib/files.js).
    receipt: {
      fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
      filename: String,
      contentType: String,
      size: Number,
    },

    // Bhojan Pass: the token is the secret part of the pass link / QR code. Admins send the pass after verifying
    // the payment; from then on (issuedAt) it shows in the participant's account and scans as valid.
    pass: {
      token: { type: String, unique: true, sparse: true },
      issuedAt: Date,
      emailedAt: Date,
      lastError: String,
    },

    // Certificate of participation, emailed after the conference.
    certificate: {
      emailedAt: Date,
      lastError: String,
    },

    status: { type: String, enum: STATUSES, default: "pending", index: true },
    adminNote: String,
    reviewedAt: Date,
  },
  { timestamps: true }
);

export const Registration = mongoose.model("Registration", registrationSchema);

const Counter = mongoose.model(
  "Counter",
  new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false })
);

export async function nextRegNo() {
  const c = await Counter.findByIdAndUpdate("registration", { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return `ABRSM26-${String(c.seq).padStart(4, "0")}`;
}

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "main", unique: true },
    registrationOpen: { type: Boolean, default: true },
    upiId: { type: String, default: UPI.id },
    payeeName: { type: String, default: UPI.payee },
    accountName: { type: String, default: "" },
    bankName: { type: String, default: "" },
    accountNo: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    contacts: [{ _id: false, name: String, role: String, phone: String }],
    qr: { fileId: mongoose.Schema.Types.ObjectId, contentType: String },
    certificate: {
      signatories: [{ _id: false, name: String, role: String }],
      // Set when admins first send certificates; from then on participants can also download theirs.
      releasedAt: Date,
    },
  },
  { timestamps: true }
);

settingsSchema.statics.load = function () {
  return this.findOneAndUpdate({ key: "main" }, {}, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
};

export const Settings = mongoose.model("Settings", settingsSchema);
