import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["rider", "driver"], required: true },
  createdAt: { type: Date, default: Date.now }
});

const driverProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
  vehicleType: { type: String, enum: ["bike", "auto", "car"], required: true },
  vehicleNumber: { type: String, required: true, trim: true },
  licenseNumber: { type: String, required: true, trim: true },
  documentName: { type: String, default: "" },
  online: { type: Boolean, default: false },
  currentLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },
  verified: { type: Boolean, default: false }
});

const rideSchema = new mongoose.Schema({
  riderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  pickup: {
    address: String,
    lat: Number,
    lng: Number
  },
  destination: {
    address: String,
    lat: Number,
    lng: Number
  },
  vehicleType: { type: String, enum: ["bike", "auto", "car"], required: true },
  distanceKm: Number,
  etaMin: Number,
  fare: Number,
  status: {
    type: String,
    enum: ["searching", "driver_assigned", "driver_arriving", "in_progress", "completed", "canceled"],
    default: "searching"
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

rideSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  next();
});

export const User = mongoose.model("User", userSchema);
export const DriverProfile = mongoose.model("DriverProfile", driverProfileSchema);
export const Ride = mongoose.model("Ride", rideSchema);
