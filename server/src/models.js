import mongoose from "mongoose";
import { CADRES, DESIGNATIONS, DISTRICTS, FEE, PAYMENT_METHODS, STATUSES } from "../../shared/constants.js";

const values = (list) => list.map((x) => x.value);

const registrationSchema = new mongoose.Schema(
  {
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
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "upi" },
    // UPI: the UTR typed by the participant. Razorpay: the payment ID (pay_…).
    utr: { type: String, required: true, unique: true },
    razorpayOrderId: { type: String, unique: true, sparse: true },
    receipt: {
      fileId: { type: mongoose.Schema.Types.ObjectId, required: function () { return this.paymentMethod === "upi"; } },
      filename: String,
      contentType: String,
      size: Number,
    },

    // Bhojan Pass: the token is the secret part of the pass link / QR code.
    pass: {
      token: { type: String, unique: true, sparse: true },
      sentAt: Date,
      sendCount: { type: Number, default: 0 },
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
    confirmationEmailedAt: Date,
  },
  { timestamps: true }
);

export const Registration = mongoose.model("Registration", registrationSchema);

// Participant details held between creating a Razorpay order and the payment succeeding.
export const PaymentOrder = mongoose.model(
  "PaymentOrder",
  new mongoose.Schema(
    {
      orderId: { type: String, required: true, unique: true },
      details: { type: Object, required: true },
      createdAt: { type: Date, default: Date.now, expires: 7 * 24 * 3600 },
    },
    { versionKey: false }
  )
);

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
    upiId: { type: String, default: "" },
    payeeName: { type: String, default: "ABRSM Gujarat" },
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
