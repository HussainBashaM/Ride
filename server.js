require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "goride-dev-secret";

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/goride")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB connection skipped/error:", err.message));

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },
  password: String,
  role: { type: String, enum: ["user", "driver", "admin"], default: "user" },
  createdAt: { type: Date, default: Date.now }
});

const driverSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  licenceNumber: String,
  vehicleType: String,
  vehicleModel: String,
  vehicleNumber: String,
  verificationStatus: { type: String, default: "pending" },
  online: { type: Boolean, default: false },
  location: {
    lat: Number,
    lng: Number
  }
});

const rideSchema = new mongoose.Schema({
  passengerId: mongoose.Schema.Types.ObjectId,
  driverId: mongoose.Schema.Types.ObjectId,
  pickup: { name: String, lat: Number, lng: Number },
  destination: { name: String, lat: Number, lng: Number },
  vehicleType: String,
  distance: Number,
  estimatedTime: Number,
  fare: Number,
  status: { type: String, default: "SEARCHING_DRIVER" },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Driver = mongoose.model("Driver", driverSchema);
const Ride = mongoose.model("Ride", rideSchema);

function tokenFor(user) {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: "Login required" });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

function fare(distance, vehicle) {
  const rates = {
    Bike: { base: 25, km: 9 },
    Auto: { base: 35, km: 13 },
    Car: { base: 55, km: 18 }
  };
  const r = rates[vehicle] || rates.Bike;
  return Math.round(r.base + distance * r.km);
}

app.get("/api/health", (req, res) => {
  res.json({ success: true, project: "GoRide", message: "GoRide backend is running" });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !password || (!email && !phone))
      return res.status(400).json({ success: false, message: "Name, password and email/phone are required" });

    const query = email ? { email } : { phone };
    if (await User.findOne(query))
      return res.status(409).json({ success: false, message: "Account already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone, password: passwordHash, role: "user" });
    res.json({ success: true, token: tokenFor(user), user: { id: user._id, name: user.name, role: user.role } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, phone, password, role = "user" } = req.body;
    const user = await User.findOne(email ? { email } : { phone });
    if (!user || user.role !== role || !(await bcrypt.compare(password || "", user.password)))
      return res.status(401).json({ success: false, message: "Invalid login details" });

    res.json({ success: true, token: tokenFor(user), user: { id: user._id, name: user.name, role: user.role } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  res.json({
    success: true,
    message: "If the account exists, a reset request has been created. Connect an email/SMS provider for production delivery."
  });
});

app.post("/api/auth/reset-password", async (req, res) => {
  res.json({ success: true, message: "Reset endpoint ready. Add a signed reset token/email provider for production." });
});

app.get("/api/users/me", auth, async (req, res) => {
  const user = await User.findById(req.auth.id).select("-password");
  res.json({ success: true, user });
});

app.post("/api/drivers/register", async (req, res) => {
  try {
    const { name, email, phone, password, licenceNumber, vehicleType, vehicleModel, vehicleNumber } = req.body;
    const existing = await User.findOne(email ? { email } : { phone });
    if (existing) return res.status(409).json({ success: false, message: "Account already exists" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone, password: passwordHash, role: "driver" });
    await Driver.create({ userId: user._id, licenceNumber, vehicleType, vehicleModel, vehicleNumber });
    res.json({ success: true, token: tokenFor(user), user: { id: user._id, name, role: "driver" } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post("/api/rides/estimate", auth, (req, res) => {
  const distance = Math.max(0.5, Number(req.body.distance) || 0);
  const vehicleType = req.body.vehicleType || "Bike";
  const speed = { Bike: 32, Auto: 25, Car: 28 }[vehicleType] || 30;
  const estimatedTime = Math.max(3, Math.ceil(distance / speed * 60));
  res.json({ success: true, distance, estimatedTime, fare: fare(distance, vehicleType), vehicleType });
});

app.post("/api/rides", auth, async (req, res) => {
  try {
    const { pickup, destination, vehicleType, distance, estimatedTime, fare: clientFare } = req.body;
    const d = Number(distance) || 0;
    const serverFare = fare(d, vehicleType);
    const ride = await Ride.create({
      passengerId: req.auth.id, pickup, destination, vehicleType,
      distance: d, estimatedTime: Number(estimatedTime) || 0,
      fare: serverFare, status: "SEARCHING_DRIVER"
    });
    io.emit("ride:new", ride);
    res.json({ success: true, ride });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get("/api/rides/my", auth, async (req, res) => {
  const rides = await Ride.find({ passengerId: req.auth.id }).sort({ createdAt: -1 });
  res.json({ success: true, rides });
});

app.post("/api/drivers/status", auth, async (req, res) => {
  const driver = await Driver.findOneAndUpdate(
    { userId: req.auth.id },
    { online: !!req.body.online, location: req.body.location || {} },
    { new: true }
  );
  if (!driver) return res.status(404).json({ success: false, message: "Driver profile not found" });
  io.emit("driver:status", { driverId: driver._id, online: driver.online, location: driver.location });
  res.json({ success: true, driver });
});

app.post("/api/rides/:id/accept", auth, async (req, res) => {
  const ride = await Ride.findByIdAndUpdate(
    req.params.id,
    { driverId: req.auth.id, status: "DRIVER_ASSIGNED" },
    { new: true }
  );
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
  io.emit("ride:update", ride);
  res.json({ success: true, ride });
});

app.post("/api/rides/:id/status", auth, async (req, res) => {
  const allowed = ["DRIVER_ARRIVING", "DRIVER_AT_PICKUP", "RIDE_STARTED", "RIDE_COMPLETED", "CANCELLED"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ success: false, message: "Invalid status" });
  const ride = await Ride.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
  io.emit("ride:update", ride);
  res.json({ success: true, ride });
});

io.on("connection", socket => {
  socket.on("join:user", id => socket.join(`user:${id}`));
  socket.on("join:driver", id => socket.join(`driver:${id}`));
  socket.on("driver:location", data => io.emit("driver:location", data));
});

server.listen(PORT, () => console.log(`GoRide server running on port ${PORT}`));
