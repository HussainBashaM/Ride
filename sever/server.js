import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { User, DriverProfile, Ride } from "./models.js";
import { auth, role } from "./middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

function sign(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role };
}

const rates = {
  bike: { base: 30, perKm: 9, speed: 28 },
  auto: { base: 45, perKm: 13, speed: 24 },
  car: { base: 70, perKm: 18, speed: 30 }
};

app.get("/api/health", (req, res) => res.json({ ok: true, service: "GoRide API" }));

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, phone, password, role: requestedRole = "rider", vehicleType, vehicleNumber, licenseNumber, documentName } = req.body;
    if (!name || !email || !phone || !password) return res.status(400).json({ message: "Name, email, phone and password are required." });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
    const userRole = requestedRole === "driver" ? "driver" : "rider";
    if (userRole === "driver" && (!vehicleType || !vehicleNumber || !licenseNumber)) {
      return res.status(400).json({ message: "Driver vehicle and license details are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ message: "An account with this email already exists." });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email: normalizedEmail, phone, passwordHash, role: userRole });

    if (userRole === "driver") {
      await DriverProfile.create({ userId: user._id, vehicleType, vehicleNumber, licenseNumber, documentName });
    }

    res.status(201).json({ token: sign(user), user: publicUser(user), message: "Account created successfully." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Registration failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, role: loginRole } = req.body;
    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });
    if (!user || user.role !== loginRole) return res.status(401).json({ message: "Invalid credentials or role." });
    const ok = await bcrypt.compare(password || "", user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials or role." });
    res.json({ token: sign(user), user: publicUser(user) });
  } catch {
    res.status(500).json({ message: "Login failed." });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  // Demo-safe response. Production should email a one-time, short-lived reset token.
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required." });
  res.json({ message: "If the account exists, password reset instructions will be sent to the email address." });
});

app.post("/api/auth/reset-password", async (req, res) => {
  // Demo flow: requires an authenticated session. Production should use a signed one-time email token.
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ message: "New password must be at least 8 characters." });
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return res.status(401).json({ message: "Use the logged-in account to demonstrate this reset flow." });
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const hash = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(decoded.id, { passwordHash: hash });
    res.json({ message: "Password reset successfully." });
  } catch {
    res.status(401).json({ message: "Unable to reset password." });
  }
});

app.get("/api/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ user: publicUser(user) });
});

app.post("/api/rides", auth, role("rider"), async (req, res) => {
  try {
    const { pickup, destination, vehicleType, distanceKm, etaMin, fare } = req.body;
    if (!pickup?.lat || !pickup?.lng || !destination?.lat || !destination?.lng) {
      return res.status(400).json({ message: "Valid pickup and destination coordinates are required." });
    }
    if (!rates[vehicleType]) return res.status(400).json({ message: "Invalid vehicle type." });

    const ride = await Ride.create({
      riderId: req.user.id, pickup, destination, vehicleType,
      distanceKm, etaMin, fare, status: "searching"
    });
    res.status(201).json({ ride });
  } catch {
    res.status(500).json({ message: "Could not create ride." });
  }
});

app.get("/api/rides/mine", auth, role("rider"), async (req, res) => {
  const rides = await Ride.find({ riderId: req.user.id }).sort({ createdAt: -1 }).limit(20).populate("driverId", "name phone");
  res.json({ rides });
});

app.get("/api/rides/:id", auth, async (req, res) => {
  const ride = await Ride.findById(req.params.id).populate("driverId", "name phone");
  if (!ride) return res.status(404).json({ message: "Ride not found." });
  if (req.user.role === "rider" && ride.riderId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden." });
  if (req.user.role === "driver" && ride.driverId && ride.driverId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden." });
  res.json({ ride });
});

app.put("/api/rides/:id/cancel", auth, async (req, res) => {
  const ride = await Ride.findById(req.params.id);
  if (!ride) return res.status(404).json({ message: "Ride not found." });
  const allowed = (req.user.role === "rider" && ride.riderId.toString() === req.user.id) ||
                  (req.user.role === "driver" && ride.driverId?.toString() === req.user.id);
  if (!allowed) return res.status(403).json({ message: "Forbidden." });
  if (["completed", "canceled"].includes(ride.status)) return res.status(400).json({ message: "Ride is already finished." });
  ride.status = "canceled";
  await ride.save();
  res.json({ ride });
});

app.get("/api/drivers/requests", auth, role("driver"), async (req, res) => {
  const rides = await Ride.find({ status: "searching" }).sort({ createdAt: -1 }).limit(10);
  res.json({ rides });
});

app.put("/api/drivers/status", auth, role("driver"), async (req, res) => {
  const { online } = req.body;
  const profile = await DriverProfile.findOneAndUpdate({ userId: req.user.id }, { online: !!online }, { new: true });
  if (!profile) return res.status(404).json({ message: "Driver profile not found." });
  res.json({ online: profile.online });
});

app.put("/api/drivers/location", auth, role("driver"), async (req, res) => {
  const { lat, lng } = req.body;
  const profile = await DriverProfile.findOneAndUpdate(
    { userId: req.user.id },
    { currentLocation: { lat, lng, updatedAt: new Date() } },
    { new: true }
  );
  if (!profile) return res.status(404).json({ message: "Driver profile not found." });
  res.json({ location: profile.currentLocation });
});

app.put("/api/drivers/rides/:id/accept", auth, role("driver"), async (req, res) => {
  const ride = await Ride.findOneAndUpdate(
    { _id: req.params.id, status: "searching" },
    { driverId: req.user.id, status: "driver_assigned" },
    { new: true }
  );
  if (!ride) return res.status(409).json({ message: "Ride is no longer available." });
  res.json({ ride });
});

app.put("/api/drivers/rides/:id/skip", auth, role("driver"), async (req, res) => {
  res.json({ message: "Ride skipped." });
});

app.put("/api/drivers/rides/:id/status", auth, role("driver"), async (req, res) => {
  const { status } = req.body;
  const allowed = ["driver_arriving", "in_progress", "completed", "canceled"];
  if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid ride status." });
  const ride = await Ride.findOne({ _id: req.params.id, driverId: req.user.id });
  if (!ride) return res.status(404).json({ message: "Assigned ride not found." });
  ride.status = status;
  await ride.save();
  res.json({ ride });
});

app.get("/api/drivers/active-ride", auth, role("driver"), async (req, res) => {
  const ride = await Ride.findOne({
    driverId: req.user.id,
    status: { $in: ["driver_assigned", "driver_arriving", "in_progress"] }
  }).sort({ updatedAt: -1 });
  res.json({ ride });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "..", "public", "index.html")));

const PORT = Number(process.env.PORT || 5000);

async function start() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    console.error("Missing MONGODB_URI or JWT_SECRET in .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");
  app.listen(PORT, () => console.log(`GoRide running on http://localhost:${PORT}`));
}

start().catch(err => {
  console.error("Startup failed:", err.message);
  process.exit(1);
});
