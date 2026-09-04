/* =========================================================
   GoRide Backend — Part 1/5
   Server setup + MongoDB + Models + Authentication
   ========================================================= */

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();


/* =========================================================
   APP SETUP
   ========================================================= */

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
    }
});


/* =========================================================
   CONFIGURATION
   ========================================================= */

const PORT =
    process.env.PORT || 10000;

const MONGODB_URI =
    process.env.MONGODB_URI;

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "goride_secret_key";


/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(
    cors({
        origin: "*"
    })
);

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(
    express.urlencoded({
        extended: true
    })
);


/* =========================================================
   MONGODB CONNECTION
   ========================================================= */

if (!MONGODB_URI) {

    console.error(
        "❌ MONGODB_URI is missing in environment variables"
    );

} else {

    mongoose
        .connect(MONGODB_URI)
        .then(function () {

            console.log(
                "✅ MongoDB connected successfully"
            );

        })
        .catch(function (error) {

            console.error(
                "❌ MongoDB connection error:",
                error.message
            );

        });
}


/* =========================================================
   USER SCHEMA
   ========================================================= */

const userSchema =
    new mongoose.Schema(
        {

            name: {
                type: String,
                required: true,
                trim: true
            },

            phone: {
                type: String,
                required: true,
                unique: true,
                trim: true
            },

            password: {
                type: String,
                required: true
            },

            role: {
                type: String,
                enum: [
                    "passenger",
                    "driver"
                ],
                default: "passenger"
            }

        },
        {
            timestamps: true
        }
    );


const User =
    mongoose.models.User ||
    mongoose.model(
        "User",
        userSchema
    );


/* =========================================================
   DRIVER SCHEMA
   ========================================================= */

const driverSchema =
    new mongoose.Schema(
        {

            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
                unique: true
            },

            name: {
                type: String,
                default: ""
            },

            phone: {
                type: String,
                default: ""
            },

            licenceNumber: {
                type: String,
                default: ""
            },

            vehicleType: {
                type: String,
                default: "Bike"
            },

            vehicleModel: {
                type: String,
                default: ""
            },

            vehicleNumber: {
                type: String,
                default: ""
            },

            registrationNumber: {
                type: String,
                default: ""
            },

            online: {
                type: Boolean,
                default: false
            },

            location: {

                lat: {
                    type: Number,
                    default: null
                },

                lng: {
                    type: Number,
                    default: null
                }

            },

            activeRideId: {
                type:
                    mongoose.Schema.Types.ObjectId,
                ref: "Ride",
                default: null
            }

        },
        {
            timestamps: true
        }
    );


const Driver =
    mongoose.models.Driver ||
    mongoose.model(
        "Driver",
        driverSchema
    );


/* =========================================================
   RIDE SCHEMA
   ========================================================= */

const rideSchema =
    new mongoose.Schema(
        {

            passengerId: {
                type:
                    mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true
            },

            driverId: {
                type:
                    mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null
            },


            /* =========================
               PICKUP
               ========================= */

            pickup: {

                name: {
                    type: String,
                    default: ""
                },

                lat: {
                    type: Number,
                    default: null
                },

                lng: {
                    type: Number,
                    default: null
                }

            },


            /* =========================
               DESTINATION
               ========================= */

            destination: {

                name: {
                    type: String,
                    default: ""
                },

                lat: {
                    type: Number,
                    default: null
                },

                lng: {
                    type: Number,
                    default: null
                }

            },


            /* =========================
               RIDE DETAILS
               ========================= */

            vehicleType: {
                type: String,
                default: "Bike"
            },

            distance: {
                type: Number,
                default: 0
            },

            estimatedTime: {
                type: Number,
                default: 0
            },

            fare: {
                type: Number,
                default: 0
            },


            /* =========================
               DRIVER LOCATION
               ========================= */

            driverLocation: {

                lat: {
                    type: Number,
                    default: null
                },

                lng: {
                    type: Number,
                    default: null
                }

            },


            /* =========================
               RIDE STATUS
               ========================= */

            status: {

                type: String,

                enum: [
                    "SEARCHING_DRIVER",
                    "DRIVER_ASSIGNED",
                    "DRIVER_ARRIVING",
                    "DRIVER_AT_PICKUP",
                    "RIDE_STARTED",
                    "RIDE_COMPLETED",
                    "CANCELLED"
                ],

                default:
                    "SEARCHING_DRIVER"

            },


            /* =========================
               CANCELLATION
               ========================= */

            cancelledBy: {
                type: String,
                enum: [
                    "passenger",
                    "driver",
                    null
                ],
                default: null
            },

            cancellationReason: {
                type: String,
                default: ""
            }

        },
        {
            timestamps: true
        }
    );


const Ride =
    mongoose.models.Ride ||
    mongoose.model(
        "Ride",
        rideSchema
    );


/* =========================================================
   AUTHENTICATION MIDDLEWARE
   ========================================================= */

function auth(req, res, next) {

    try {

        const header =
            req.headers.authorization ||
            "";

        if (
            !header ||
            !header.startsWith("Bearer ")
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required"

            });

        }


        const token =
            header.substring(7);


        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        req.auth = {

            id:
                decoded.id,

            role:
                decoded.role

        };


        next();


    } catch (error) {

        console.error(
            "Auth error:",
            error.message
        );


        return res.status(401).json({

            success: false,

            message:
                "Invalid or expired token"

        });

    }
}


/* =========================================================
   CREATE JWT
   ========================================================= */

function createToken(user) {

    return jwt.sign(

        {
            id:
                user._id.toString(),

            role:
                user.role
        },

        JWT_SECRET,

        {
            expiresIn:
                "30d"
        }

    );
}


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get(
    "/",
    function (req, res) {

        res.json({

            success: true,

            message:
                "GoRide backend is running",

            version:
                "2.0.0"

        });

    }
);


app.get(
    "/api/health",
    function (req, res) {

        res.json({

            success: true,

            message:
                "GoRide API is healthy",

            mongodb:
                mongoose.connection.readyState === 1
                    ? "connected"
                    : "disconnected"

        });

    }
);


/* =========================================================
   SOCKET.IO BASIC CONNECTION
   ========================================================= */

io.on(
    "connection",
    function (socket) {

        console.log(
            "🔌 Socket connected:",
            socket.id
        );


        socket.on(
            "disconnect",
            function () {

                console.log(
                    "🔌 Socket disconnected:",
                    socket.id
                );

            }
        );

    }
);


/* =========================================================
   EXPORT GLOBAL REFERENCES
   ========================================================= */

global.io = io;

global.User = User;

global.Driver = Driver;

global.Ride = Ride;

global.auth = auth;


/* =========================================================
   IMPORTANT
   =========================================================

   PART 2 will continue from here.

   DO NOT add another:
       const express = require("express");
       const app = express();
       const io = new Server(...);

   Part 2 should be pasted directly AFTER this part.
   ========================================================= */
/* =========================================================
   GoRide Backend — Part 2/5
   REGISTER + LOGIN + DRIVER PROFILE + ONLINE/OFFLINE
   ========================================================= */


/* =========================================================
   USER REGISTER
   ========================================================= */

app.post(
    "/api/auth/register",
    async function (req, res) {

        try {

            const {
                name,
                phone,
                password,
                role
            } = req.body;


            /* =========================
               VALIDATION
               ========================= */

            if (
                !name ||
                !phone ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Name, phone and password are required"

                });

            }


            if (password.length < 6) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password must contain at least 6 characters"

                });

            }


            const userRole =
                role === "driver"
                    ? "driver"
                    : "passenger";


            /* =========================
               CHECK EXISTING USER
               ========================= */

            const existingUser =
                await User.findOne({
                    phone: phone.trim()
                });


            if (existingUser) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Phone number is already registered"

                });

            }


            /* =========================
               HASH PASSWORD
               ========================= */

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );


            /* =========================
               CREATE USER
               ========================= */

            const user =
                await User.create({

                    name:
                        name.trim(),

                    phone:
                        phone.trim(),

                    password:
                        hashedPassword,

                    role:
                        userRole

                });


            /* =========================
               CREATE DRIVER PROFILE
               ========================= */

            if (userRole === "driver") {

                await Driver.create({

                    userId:
                        user._id,

                    name:
                        user.name,

                    phone:
                        user.phone,

                    online:
                        false,

                    location: {

                        lat: null,
                        lng: null

                    }

                });

            }


            /* =========================
               TOKEN
               ========================= */

            const token =
                createToken(user);


            res.status(201).json({

                success: true,

                message:
                    "Registration successful",

                token,

                user: {

                    id:
                        user._id,

                    _id:
                        user._id,

                    name:
                        user.name,

                    phone:
                        user.phone,

                    role:
                        user.role

                }

            });


        } catch (error) {

            console.error(
                "Register error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Registration failed"

            });

        }

    }
);


/* =========================================================
   LOGIN
   ========================================================= */

app.post(
    "/api/auth/login",
    async function (req, res) {

        try {

            const {
                phone,
                password
            } = req.body;


            /* =========================
               VALIDATION
               ========================= */

            if (
                !phone ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Phone and password are required"

                });

            }


            /* =========================
               FIND USER
               ========================= */

            const user =
                await User.findOne({

                    phone:
                        phone.trim()

                });


            if (!user) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid phone number or password"

                });

            }


            /* =========================
               CHECK PASSWORD
               ========================= */

            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );


            if (!passwordMatch) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid phone number or password"

                });

            }


            /* =========================
               DRIVER PROFILE
               ========================= */

            let driver = null;


            if (
                user.role === "driver"
            ) {

                driver =
                    await Driver.findOne({

                        userId:
                            user._id

                    });

            }


            /* =========================
               TOKEN
               ========================= */

            const token =
                createToken(user);


            res.json({

                success: true,

                message:
                    "Login successful",

                token,

                user: {

                    id:
                        user._id,

                    _id:
                        user._id,

                    name:
                        user.name,

                    phone:
                        user.phone,

                    role:
                        user.role

                },

                driver:
                    driver
                        ? {

                            id:
                                driver._id,

                            online:
                                driver.online,

                            location:
                                driver.location,

                            vehicleType:
                                driver.vehicleType,

                            vehicleModel:
                                driver.vehicleModel,

                            vehicleNumber:
                                driver.vehicleNumber

                        }
                        : null

            });


        } catch (error) {

            console.error(
                "Login error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Login failed"

            });

        }

    }
);


/* =========================================================
   GET CURRENT USER
   ========================================================= */

app.get(
    "/api/auth/me",
    auth,
    async function (req, res) {

        try {

            const user =
                await User.findById(
                    req.auth.id
                ).select(
                    "-password"
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found"

                });

            }


            let driver = null;


            if (
                user.role === "driver"
            ) {

                driver =
                    await Driver.findOne({

                        userId:
                            user._id

                    });

            }


            res.json({

                success: true,

                user,

                driver

            });


        } catch (error) {

            console.error(
                "Get user error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to get user"

            });

        }

    }
);


/* =========================================================
   GET DRIVER PROFILE
   ========================================================= */

app.get(
    "/api/drivers/profile",
    auth,
    async function (req, res) {

        try {

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can access this profile"

                });

            }


            const driver =
                await Driver.findOne({

                    userId:
                        req.auth.id

                });


            if (!driver) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Driver profile not found"

                });

            }


            res.json({

                success: true,

                driver

            });


        } catch (error) {

            console.error(
                "Driver profile error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load driver profile"

            });

        }

    }
);


/* =========================================================
   UPDATE DRIVER PROFILE
   ========================================================= */

app.put(
    "/api/drivers/profile",
    auth,
    async function (req, res) {

        try {

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can update this profile"

                });

            }


            const {
                name,
                phone,
                licenceNumber,
                vehicleType,
                vehicleModel,
                vehicleNumber,
                registrationNumber
            } = req.body;


            const driver =
                await Driver.findOne({

                    userId:
                        req.auth.id

                });


            if (!driver) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Driver profile not found"

                });

            }


            /* =========================
               UPDATE DRIVER DETAILS
               ========================= */

            if (
                typeof name === "string" &&
                name.trim()
            ) {

                driver.name =
                    name.trim();

            }


            if (
                typeof phone === "string" &&
                phone.trim()
            ) {

                driver.phone =
                    phone.trim();

            }


            if (
                typeof licenceNumber === "string"
            ) {

                driver.licenceNumber =
                    licenceNumber.trim();

            }


            if (
                typeof vehicleType === "string" &&
                vehicleType.trim()
            ) {

                driver.vehicleType =
                    vehicleType.trim();

            }


            if (
                typeof vehicleModel === "string"
            ) {

                driver.vehicleModel =
                    vehicleModel.trim();

            }


            if (
                typeof vehicleNumber === "string"
            ) {

                driver.vehicleNumber =
                    vehicleNumber.trim();

            }


            if (
                typeof registrationNumber === "string"
            ) {

                driver.registrationNumber =
                    registrationNumber.trim();

            }


            await driver.save();


            /* =========================
               ALSO UPDATE USER
               ========================= */

            const user =
                await User.findById(
                    req.auth.id
                );


            if (user) {

                if (
                    driver.name &&
                    user.name !== driver.name
                ) {

                    user.name =
                        driver.name;

                }


                if (
                    driver.phone &&
                    user.phone !== driver.phone
                ) {

                    user.phone =
                        driver.phone;

                }


                await user.save();

            }


            res.json({

                success: true,

                message:
                    "Driver profile updated",

                driver

            });


        } catch (error) {

            console.error(
                "Update driver profile error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Unable to update driver profile"

            });

        }

    }
);


/* =========================================================
   DRIVER ONLINE / OFFLINE
   ========================================================= */

app.post(
    "/api/drivers/status",
    auth,
    async function (req, res) {

        try {

            /* =========================
               DRIVER ONLY
               ========================= */

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can change driver status"

                });

            }


            const {
                online,
                location
            } = req.body;


            const driver =
                await Driver.findOne({

                    userId:
                        req.auth.id

                });


            if (!driver) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Driver profile not found"

                });

            }


            /* =========================
               DRIVER CANNOT GO OFFLINE
               DURING ACTIVE RIDE
               ========================= */

            if (
                online === false &&
                driver.activeRideId
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Complete or cancel the active ride before going offline"

                });

            }


            /* =========================
               UPDATE ONLINE STATE
               ========================= */

            driver.online =
                Boolean(online);


            /* =========================
               UPDATE LOCATION
               ========================= */

            if (
                location &&
                typeof location.lat === "number" &&
                typeof location.lng === "number"
            ) {

                driver.location = {

                    lat:
                        location.lat,

                    lng:
                        location.lng

                };

            }


            await driver.save();


            /* =========================
               SOCKET DRIVER STATUS
               ========================= */

            io.emit(
                "driver:status",
                {

                    driverId:
                        req.auth.id,

                    online:
                        driver.online,

                    location:
                        driver.location

                }
            );


            res.json({

                success: true,

                message:
                    driver.online
                        ? "Driver is now online"
                        : "Driver is now offline",

                online:
                    driver.online,

                location:
                    driver.location

            });


        } catch (error) {

            console.error(
                "Driver status error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Unable to update driver status"

            });

        }

    }
);


/* =========================================================
   DRIVER LOCATION UPDATE
   ========================================================= */

app.post(
    "/api/drivers/location",
    auth,
    async function (req, res) {

        try {

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can update location"

                });

            }


            const {
                lat,
                lng
            } = req.body;


            if (
                typeof lat !== "number" ||
                typeof lng !== "number"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid latitude and longitude are required"

                });

            }


            const driver =
                await Driver.findOneAndUpdate(

                    {
                        userId:
                            req.auth.id
                    },

                    {
                        location: {

                            lat,
                            lng

                        }
                    },

                    {
                        new: true
                    }

                );


            if (!driver) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Driver profile not found"

                });

            }


            /* =========================
               SEND LIVE LOCATION
               ========================= */
io.to(
                `driver:${req.auth.id}`
            ).emit(
                "driver:location",
                {

                    driverId:
                        req.auth.id,

                    location: {

                        lat,
                        lng

                    }

                }
            );


            io.emit(
                "driver:location",
                {

                    driverId:
                        req.auth.id,

                    location: {

                        lat,
                        lng

                    }

                }
            );


            res.json({

                success: true,

                location:
                    driver.location

            });


        } catch (error) {

            console.error(
                "Driver location error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to update driver location"

            });

        }

    }
);


/* =========================================================
   DRIVER ACTIVE RIDE
   ========================================================= */

app.get(
    "/api/drivers/active-ride",
    auth,
    async function (req, res) {

        try {

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can access this"

                });

            }


            const driver =
                await Driver.findOne({

                    userId:
                        req.auth.id

                });


            if (
                !driver ||
                !driver.activeRideId
            ) {

                return res.json({

                    success: true,

                    ride: null

                });

            }


            const ride =
                await Ride.findById(
                    driver.activeRideId
                );


            res.json({

                success: true,

                ride:
                    ride || null

            });


        } catch (error) {

            console.error(
                "Driver active ride error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load active ride"

            });

        }

    }
);


/* =========================================================
   SOCKET ROOM JOINING
   ========================================================= */

io.on(
    "connection",
    function (socket) {


        /* =========================
           PASSENGER ROOM
           ========================= */

        socket.on(
            "join:user",
            function (userId) {

                if (!userId) {
                    return;
                }

                socket.join(
                    `user:${userId}`
                );

                console.log(
                    `👤 User joined room: user:${userId}`
                );

            }
        );


        /* =========================
           DRIVER ROOM
           ========================= */

        socket.on(
            "join:driver",
            function (driverId) {

                if (!driverId) {
                    return;
                }

                socket.join(
                    `driver:${driverId}`
                );

                console.log(
                    `🚗 Driver joined room: driver:${driverId}`
                );

            }
        );


        /* =========================
           LEAVE DRIVER ROOM
           ========================= */

        socket.on(
            "leave:driver",
            function (driverId) {

                if (!driverId) {
                    return;
                }

                socket.leave(
                    `driver:${driverId}`
                );

                console.log(
                    `🚗 Driver left room: driver:${driverId}`
                );

            }
        );

    }
);


/* =========================================================
   END OF PART 2
   =========================================================

   Paste PART 3 DIRECTLY BELOW this section.

   Part 3 will contain:

   • Fare calculation
   • Nearby driver calculation
   • Ride creation
   • SEARCHING_DRIVER
   • Sending ride:new to nearby drivers
   ========================================================= */
/* =========================================================
   GoRide Backend — Part 3/5
   FARE CALCULATION + NEARBY DRIVER MATCHING + CREATE RIDE
   ========================================================= */


/* =========================================================
   DISTANCE CALCULATION — HAVERSINE
   ========================================================= */

function calculateDistance(
    lat1,
    lng1,
    lat2,
    lng2
) {

    const earthRadius = 6371;

    const toRadians =
        function (value) {
            return value *
                Math.PI /
                180;
        };


    const dLat =
        toRadians(lat2 - lat1);

    const dLng =
        toRadians(lng2 - lng1);


    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(
            toRadians(lat1)
        ) *
        Math.cos(
            toRadians(lat2)
        ) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return earthRadius * c;
}


/* =========================================================
   FARE CALCULATION
   ========================================================= */

function calculateFare(
    distance,
    vehicleType
) {

    const km =
        Math.max(
            Number(distance) || 0,
            0
        );


    const type =
        String(
            vehicleType || "Bike"
        ).toLowerCase();


    let baseFare = 0;
    let perKm = 0;
    let minimumFare = 0;


    /* =========================
       BIKE
       ========================= */

    if (type === "bike") {

        baseFare = 30;
        perKm = 10;
        minimumFare = 40;

    }


    /* =========================
       AUTO
       ========================= */

    else if (type === "auto") {

        baseFare = 40;
        perKm = 14;
        minimumFare = 50;

    }


    /* =========================
       CAR
       ========================= */

    else if (type === "car") {

        baseFare = 70;
        perKm = 18;
        minimumFare = 80;

    }


    /* =========================
       DEFAULT
       ========================= */

    else {

        baseFare = 30;
        perKm = 10;
        minimumFare = 40;

    }


    const calculated =
        baseFare +
        (km * perKm);


    return Math.max(
        Math.round(calculated),
        minimumFare
    );
}


/* =========================================================
   FARE ESTIMATION API
   ========================================================= */

app.post(
    "/api/fare/estimate",
    auth,
    async function (req, res) {

        try {

            const {
                distance,
                vehicleType
            } = req.body;


            const km =
                Number(distance);


            if (
                !Number.isFinite(km) ||
                km < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid distance is required"

                });

            }


            const fare =
                calculateFare(
                    km,
                    vehicleType
                );


            res.json({

                success: true,

                distance:
                    Number(km.toFixed(2)),

                vehicleType:
                    vehicleType || "Bike",

                fare

            });


        } catch (error) {

            console.error(
                "Fare estimate error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to calculate fare"

            });

        }

    }
);


/* =========================================================
   FIND NEARBY ONLINE DRIVERS
   ========================================================= */

async function findNearbyDrivers(
    pickupLat,
    pickupLng,
    vehicleType,
    radiusKm = 10
) {

    const drivers =
        await Driver.find({

            online: true,

            activeRideId: null,

            "location.lat": {
                $ne: null
            },

            "location.lng": {
                $ne: null
            }

        });


    const nearby = [];


    for (
        const driver of drivers
    ) {

        const driverLat =
            Number(
                driver.location?.lat
            );

        const driverLng =
            Number(
                driver.location?.lng
            );


        if (
            !Number.isFinite(driverLat) ||
            !Number.isFinite(driverLng)
        ) {

            continue;

        }


        const distance =
            calculateDistance(

                pickupLat,
                pickupLng,

                driverLat,
                driverLng

            );


        if (
            distance <= radiusKm
        ) {

            nearby.push({

                driver,

                distance

            });

        }

    }


    /* =========================
       CLOSEST DRIVER FIRST
       ========================= */

    nearby.sort(

        function (a, b) {

            return (
                a.distance -
                b.distance
            );

        }

    );


    return nearby;
}


/* =========================================================
   CREATE RIDE
   ========================================================= */

app.post(
    "/api/rides",
    auth,
    async function (req, res) {

        try {

            /* =========================
               PASSENGER ONLY
               ========================= */

            if (
                req.auth.role !== "passenger"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only passengers can book rides"

                });

            }


            const {
                pickup,
                destination,
                vehicleType,
                distance,
                estimatedTime,
                fare
            } = req.body;


            /* =========================
               VALIDATION
               ========================= */

            if (
                !pickup ||
                !destination
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Pickup and destination are required"

                });

            }


            const pickupLat =
                Number(pickup.lat);

            const pickupLng =
                Number(pickup.lng);


            const destinationLat =
                Number(destination.lat);

            const destinationLng =
                Number(destination.lng);


            if (
                !Number.isFinite(pickupLat) ||
                !Number.isFinite(pickupLng)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid pickup coordinates are required"

                });

            }


            if (
                !Number.isFinite(destinationLat) ||
                !Number.isFinite(destinationLng)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid destination coordinates are required"

                });

            }


            /* =========================
               CHECK EXISTING ACTIVE RIDE
               ========================= */

            const existingRide =
                await Ride.findOne({

                    passengerId:
                        req.auth.id,

                    status: {
                        $in: [

                            "SEARCHING_DRIVER",
                            "DRIVER_ASSIGNED",
                            "DRIVER_ARRIVING",
                            "DRIVER_AT_PICKUP",
                            "RIDE_STARTED"

                        ]
                    }

                });


            if (existingRide) {

                return res.status(409).json({

                    success: false,

                    message:
                        "You already have an active ride",

                    ride:
                        existingRide

                });

            }


            /* =========================
               CALCULATE DISTANCE
               ========================= */

            let rideDistance =
                Number(distance);


            if (
                !Number.isFinite(rideDistance) ||
                rideDistance <= 0
            ) {

                rideDistance =
                    calculateDistance(

                        pickupLat,
                        pickupLng,

                        destinationLat,
                        destinationLng

                    );

            }


            /*
             * Small correction for
             * road-distance approximation.
             */

            rideDistance =
                Number(
                    (
                        rideDistance *
                        1.15
                    ).toFixed(2)
                );


            /* =========================
               ESTIMATED TIME
               ========================= */

            let rideTime =
                Number(estimatedTime);


            if (
                !Number.isFinite(rideTime) ||
                rideTime <= 0
            ) {

                /*
                 * Approximate city speed:
                 * 25 km/h
                 */

                rideTime =
                    Math.max(

                        1,

                        Math.round(
                            (
                                rideDistance /
                                25
                            ) * 60
                        )

                    );

            }


            /* =========================
               FARE
               ========================= */

            const calculatedFare =
                calculateFare(

                    rideDistance,

                    vehicleType

                );


            /*
             * Server is authoritative.
             * Client-provided fare is not trusted.
             */

            const finalFare =
                calculatedFare;


            /* =========================
               CREATE RIDE
               ========================= */

            const ride =
                await Ride.create({

                    passengerId:
                        req.auth.id,

                    driverId:
                        null,

                    pickup: {

                        name:
                            pickup.name ||
                            "Pickup location",

                        lat:
                            pickupLat,

                        lng:
                            pickupLng

                    },

                    destination: {

                        name:
                            destination.name ||
                            "Destination",

                        lat:
                            destinationLat,

                        lng:
                            destinationLng

                    },

                    vehicleType:
                        vehicleType ||
                        "Bike",

                    distance:
                        rideDistance,

                    estimatedTime:
                        rideTime,

                    fare:
                        finalFare,

                    driverLocation: {

                        lat: null,

                        lng: null

                    },

                    status:
                        "SEARCHING_DRIVER"

                });


            /* =========================
               FIND NEARBY DRIVERS
               ========================= */

            const nearbyDrivers =
                await findNearbyDrivers(

                    pickupLat,
                    pickupLng,

                    vehicleType,

                    10

                );


            console.log(
                `🚗 Nearby drivers found: ${nearbyDrivers.length}`
            );


            /* =========================
               SEND RIDE REQUEST
               ========================= */

            for (
                const item of nearbyDrivers
            ) {

                const driver =
                    item.driver;


                const rideRequest = {

                    ...ride.toObject(),

                    nearbyDistance:
                        Number(
                            item.distance.toFixed(2)
                        )

                };


                /*
                 * Send directly to driver's room.
                 */

                io.to(
                    `driver:${driver.userId}`
                ).emit(
                    "ride:new",
                    rideRequest
                );

            }


            /* =========================
               GLOBAL EVENT
               ========================= */

            io.emit(
                "ride:created",
                ride
            );


            /* =========================
               PASSENGER ROOM
               ========================= */

            io.to(
                `user:${req.auth.id}`
            ).emit(
                "ride:update",
                ride
            );


            /* =========================
               RESPONSE
               ========================= */

            res.status(201).json({

                success: true,

                message:
                    nearbyDrivers.length > 0
                        ? "Ride request sent to nearby drivers"
                        : "Ride created. Searching for nearby drivers.",

                ride,

                nearbyDrivers:
                    nearbyDrivers.length

            });


        } catch (error) {

            console.error(
                "Create ride error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Unable to create ride"

            });

        }

    }
);


/* =========================================================
   GET RIDE BY ID
   ========================================================= */

app.get(
    "/api/rides/:id",
    auth,
    async function (req, res) {

        try {

            const ride =
                await Ride.findById(
                    req.params.id
                );


            if (!ride) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Ride not found"

                });

            }


            const userId =
                String(
                    req.auth.id
                );


            const passengerId =
                String(
                    ride.passengerId
                );


            const driverId =
                ride.driverId
                    ? String(
                        ride.driverId
                    )
                    : null;


            if (
                userId !== passengerId &&
                userId !== driverId
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You are not allowed to view this ride"

                });

            }


            res.json({

                success: true,

                ride

            });


        } catch (error) {

            console.error(
                "Get ride error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to get ride"

            });

        }

    }
);


/* =========================================================
   PASSENGER ACTIVE RIDE
   ========================================================= */

app.get(
    "/api/rides/active",
    auth,
    async function (req, res) {

        try {

            const ride =
                await Ride.findOne({

                    passengerId:
                        req.auth.id,

                    status: {
                        $in: [

                            "SEARCHING_DRIVER",
                            "DRIVER_ASSIGNED",
                            "DRIVER_ARRIVING",
                            "DRIVER_AT_PICKUP",
                            "RIDE_STARTED"

                        ]
                    }

                }).sort({

                    createdAt: -1

                });


            res.json({

                success: true,

                ride:
                    ride || null

            });


        } catch (error) {

            console.error(
                "Active ride error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load active ride"

            });

        }

    }
);


/* =========================================================
   PASSENGER RIDE HISTORY
   ========================================================= */

app.get(
    "/api/rides/history",
    auth,
    async function (req, res) {

        try {

            const rides =
                await Ride.find({

                    passengerId:
                        req.auth.id,

                    status: {
                        $in: [
                            "RIDE_COMPLETED",
                            "CANCELLED"
                        ]
                    }

                }).sort({

                    createdAt: -1

                });


            res.json({

                success: true,

                rides

            });


        } catch (error) {

            console.error(
                "Ride history error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load ride history"

            });

        }

    }
);


/* =========================================================
   END OF PART 3
   =========================================================

   PART 4 will add:

   • Driver accepts ride
   • Prevent double acceptance
   • Passenger gets DRIVER_ASSIGNED
   • Driver/passenger live location
   • Driver arrives
   • Start ride
   • Destination handling
   • Ride status synchronization
   ========================================================= */

/* =========================================================
   GoRide Backend — Part 4/5
   ACCEPT RIDE + LIVE LOCATION + RIDE STATUS
   ========================================================= */


/* =========================================================
   DRIVER ACCEPT RIDE
   ========================================================= */

app.post(
    "/api/rides/:id/accept",
    auth,
    async function (req, res) {

        try {

            /* =========================
               DRIVER ONLY
               ========================= */

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can accept rides"

                });

            }


            const rideId =
                req.params.id;


            /* =========================
               FIND DRIVER
               ========================= */

            const driver =
                await Driver.findOne({

                    userId:
                        req.auth.id

                });


            if (!driver) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Driver profile not found"

                });

            }


            if (!driver.online) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Go online before accepting a ride"

                });

            }


            /* =========================
               PREVENT MULTIPLE RIDES
               ========================= */

            if (driver.activeRideId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "You already have an active ride"

                });

            }


            /* =========================
               FIND RIDE
               ========================= */

            const ride =
                await Ride.findById(
                    rideId
                );


            if (!ride) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Ride not found"

                });

            }


            /* =========================
               RIDE MUST BE SEARCHING
               ========================= */

            if (
                ride.status !==
                "SEARCHING_DRIVER"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "This ride has already been accepted by another driver"

                });

            }


            /* =========================
               ACCEPT RIDE
               ========================= */

            ride.driverId =
                driver.userId;

            ride.status =
                "DRIVER_ASSIGNED";


            /* =========================
               SAVE DRIVER LOCATION
               ========================= */

            if (
                driver.location &&
                typeof driver.location.lat === "number" &&
                typeof driver.location.lng === "number"
            ) {

                ride.driverLocation = {

                    lat:
                        driver.location.lat,

                    lng:
                        driver.location.lng

                };

            }


            await ride.save();


            /* =========================
               SAVE ACTIVE RIDE
               ========================= */

            driver.activeRideId =
                ride._id;

            await driver.save();


            /* =========================
               REMOVE REQUEST FROM
               OTHER DRIVERS
               ========================= */

            io.emit(
                "ride:update",
                ride
            );


            /* =========================
               PASSENGER UPDATE
               ========================= */

            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "ride:update",
                ride
            );


            /* =========================
               DRIVER UPDATE
               ========================= */

            io.to(
                `driver:${driver.userId}`
            ).emit(
                "ride:update",
                ride
            );


            /* =========================
               RESPONSE
               ========================= */

            res.json({

                success: true,

                message:
                    "Ride accepted successfully",

                ride

            });


        } catch (error) {

            console.error(
                "Accept ride error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Unable to accept ride"

            });

        }

    }
);


/* =========================================================
   DRIVER LIVE LOCATION
   ========================================================= */

app.post(
    "/api/rides/:id/driver-location",
    auth,
    async function (req, res) {

        try {

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can update this location"

                });

            }


            const {
                lat,
                lng
            } = req.body;


            if (
                typeof lat !== "number" ||
                typeof lng !== "number"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid coordinates are required"

                });

            }


            const ride =
                await Ride.findById(
                    req.params.id
                );


            if (!ride) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Ride not found"

                });

            }


            if (
                String(ride.driverId) !==
                String(req.auth.id)
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "This ride is not assigned to you"

                });

            }


            /* =========================
               SAVE RIDE LOCATION
               ========================= */

            ride.driverLocation = {

                lat,
                lng

            };


            await ride.save();


            /* =========================
               ALSO SAVE DRIVER LOCATION
               ========================= */

            await Driver.findOneAndUpdate(

                {
                    userId:
                        req.auth.id
                },

                {
                    location: {

                        lat,
                        lng

                    }
                }

            );


            const locationData = {

                rideId:
                    ride._id,

                driverId:
                    req.auth.id,

                location: {

                    lat,
                    lng

                }

            };


            /* =========================
               SEND TO PASSENGER
               ========================= */

            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "driver:location",
                locationData
            );


            /* =========================
               SEND TO DRIVER
               ========================= */

            io.to(
                `driver:${ride.driverId}`
            ).emit(
                "driver:location",
                locationData
            );


            res.json({

                success: true,

                location:
                    ride.driverLocation

            });


        } catch (error) {

            console.error(
                "Ride driver location error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to update driver location"

            });

        }

    }
);


/* =========================================================
   PASSENGER LOCATION
   ========================================================= */

app.post(
    "/api/rides/:id/passenger-location",
    auth,
    async function (req, res) {

        try {

            if (
                req.auth.role !== "passenger"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only passengers can update passenger location"

                });

            }


            const {
                lat,
                lng
            } = req.body;


            if (
                typeof lat !== "number" ||
                typeof lng !== "number"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid coordinates are required"

                });

            }


            const ride =
                await Ride.findById(
                    req.params.id
                );


            if (!ride) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Ride not found"

                });

            }


            if (
                String(ride.passengerId) !==
                String(req.auth.id)
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "This ride does not belong to you"

                });

            }


            const passengerLocation = {

                lat,
                lng

            };


            /*
             * Keep the original pickup
             * unchanged.
             *
             * This is the passenger's
             * current live location.
             */

            ride.passengerLocation =
                passengerLocation;


            await ride.save();


            const locationData = {

                rideId:
                    ride._id,

                passengerId:
                    req.auth.id,

                location:
                    passengerLocation

            };


            /* =========================
               SEND TO DRIVER
               ========================= */

            if (ride.driverId) {

                io.to(
                    `driver:${ride.driverId}`
                ).emit(
                    "passenger:location",
                    locationData
                );

            }


            res.json({

                success: true,

                location:
                    passengerLocation

            });


        } catch (error) {

            console.error(
                "Passenger location error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to update passenger location"

            });

        }

    }
);


/* =========================================================
   GET LIVE RIDE LOCATION
   ========================================================= */

app.get(
    "/api/rides/:id/live-location",
    auth,
    async function (req, res) {

        try {

            const ride =
                await Ride.findById(
                    req.params.id
                );


            if (!ride) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Ride not found"

                });

            }


            const currentUser =
                String(
                    req.auth.id
                );


            const passenger =
                String(
                    ride.passengerId
                );


            const driver =
                ride.driverId
                    ? String(
                        ride.driverId
                    )
                    : null;


            if (
                currentUser !== passenger &&
                currentUser !== driver
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You are not part of this ride"

                });

            }


            res.json({

                success: true,

                rideId:
                    ride._id,

                status:
                    ride.status,

                pickup:
                    ride.pickup,

                destination:
                    ride.destination,

                driverLocation:
                    ride.driverLocation ||
                    null,

                passengerLocation:
                    ride.passengerLocation ||
                    null

            });


        } catch (error) {

            console.error(
                "Live location error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to get live location"

            });

        }

    }
);


/* =========================================================
   DRIVER RIDE STATUS
   ========================================================= */

app.post(
    "/api/rides/:id/status",
    auth,
    async function (req, res) {

        try {

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can update ride status"

                });

            }


            const {
                status
            } = req.body;


            const allowedStatuses = [

                "DRIVER_ARRIVING",

                "DRIVER_AT_PICKUP",

                "RIDE_STARTED",

                "RIDE_COMPLETED",

                "CANCELLED"

            ];


            if (
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid ride status"

                });

            }


            const ride =
                await Ride.findById(
                    req.params.id
                );


            if (!ride) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Ride not found"

                });

            }


            /* =========================
               DRIVER OWNERSHIP
               ========================= */

            if (
                String(ride.driverId) !==
                String(req.auth.id)
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "This ride is not assigned to you"

                });

            }


            /* =========================
               STATUS TRANSITIONS
               ========================= */

            const current =
                ride.status;


            const validTransitions = {

                DRIVER_ASSIGNED: [
                    "DRIVER_ARRIVING",
                    "CANCELLED"
                ],

                DRIVER_ARRIVING: [
                    "DRIVER_AT_PICKUP",
                    "CANCELLED"
                ],

                DRIVER_AT_PICKUP: [
                    "RIDE_STARTED",
                    "CANCELLED"
                ],

                RIDE_STARTED: [
                    "RIDE_COMPLETED",
                    "CANCELLED"
                ]

            };


            if (
                validTransitions[current] &&
                !validTransitions[current].includes(
                    status
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `Cannot change ride from ${current} to ${status}`

                });

            }


            /* =========================
               UPDATE STATUS
               ========================= */

            ride.status =
                status;


            await ride.save();


            /* =========================
               ACTIVE RIDE CLEANUP
               ========================= */

            if (
                status === "RIDE_COMPLETED" ||
                status === "CANCELLED"
            ) {

                await Driver.findOneAndUpdate(

                    {
                        userId:
                            req.auth.id
                    },

                    {
                        $set: {

                            activeRideId:
                                null,

                            online:
                                status ===
                                "RIDE_COMPLETED"

                        }

                    }

                );

            }


            /* =========================
               UPDATE DRIVER
               ========================= */

            if (
                status === "RIDE_COMPLETED" ||
                status === "CANCELLED"
            ) {

                ride.driverId =
                    ride.driverId;

            }


            /* =========================
               SEND RIDE UPDATE
               ========================= */

            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "ride:update",
                ride
            );


            if (ride.driverId) {

                io.to(
                    `driver:${ride.driverId}`
                ).emit(
                    "ride:update",
                    ride
                );

            }


            /* =========================
               GLOBAL UPDATE
               ========================= */

            io.emit(
                "ride:update",
                ride
            );


            res.json({

                success: true,

                message:
                    "Ride status updated",

                ride

            });


        } catch (error) {

            console.error(
                "Ride status error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Unable to update ride status"

            });

        }

    }
);


/* =========================================================
   DRIVER RIDE LOCATION SOCKET
   ========================================================= */

io.on(
    "connection",
    function (socket) {


        socket.on(
            "driver:location",
            async function (data) {

                try {

                    if (
                        !data ||
                        !data.driverId ||
                        !data.location
                    ) {

                        return;

                    }


                    const lat =
                        Number(
                            data.location.lat
                        );

                    const lng =
                        Number(
                            data.location.lng
                        );


                    if (
                        !Number.isFinite(lat) ||
                        !Number.isFinite(lng)
                    ) {

                        return;

                    }


                    const driver =
                        await Driver.findOne({

                            userId:
                                data.driverId

                        });


                    if (!driver) {
                        return;
                    }


                    /* =========================
                       SAVE DRIVER LOCATION
                       ========================= */

                    driver.location = {

                        lat,
                        lng

                    };


                    await driver.save();


                    /* =========================
                       FIND ACTIVE RIDE
                       ========================= */

                    if (
                        !driver.activeRideId
                    ) {

                        return;

                    }


                    const ride =
                        await Ride.findById(
                            driver.activeRideId
                        );


                    if (!ride) {
                        return;
                    }


                    ride.driverLocation = {

                        lat,
                        lng

                    };


                    await ride.save();


                    /* =========================
                       SEND TO PASSENGER
                       ========================= */

                    io.to(
                        `user:${ride.passengerId}`
                    ).emit(
                        "driver:location",
                        {

                            rideId:
                                ride._id,

                            driverId:
                                driver.userId,

                            location: {

                                lat,
                                lng

                            }

                        }
                    );


                } catch (error) {

                    console.error(
                        "Socket driver location error:",
                        error
                    );

                }

            }
        );


        /* =================================================
           DRIVER RIDE ACCEPTED EVENT
           ================================================= */

        socket.on(
            "driver:rideAccepted",
            function (data) {

                if (
                    !data ||
                    !data.passengerId
                ) {

                    return;

                }


                io.to(
                    `user:${data.passengerId}`
                ).emit(
                    "ride:update",
                    {

                        _id:
                            data.rideId,

                        status:
                            "DRIVER_ASSIGNED",

                        driverId:
                            data.driverId ||
                            null

                    }
                );

            }
        );

    }
);


/* =========================================================
   END OF PART 4
   =========================================================

   PART 5 will contain:

   • Passenger cancellation
   • Driver cancellation
   • Ride completion cleanup
   • Passenger history
   • Driver history
   • Health/status endpoint
   • Final server startup
   ========================================================= */

/* =========================================================
   GoRide Backend — Part 5/5
   CANCELLATION + COMPLETION + HISTORY + HEALTH
   ========================================================= */


/* =========================================================
   PASSENGER CANCEL RIDE
   ========================================================= */

app.post(
    "/api/rides/:id/cancel",
    auth,
    async function (req, res) {

        try {

            const ride =
                await Ride.findById(
                    req.params.id
                );


            if (!ride) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Ride not found"

                });

            }


            /* =========================
               PASSENGER OWNERSHIP
               ========================= */

            if (
                String(ride.passengerId) !==
                String(req.auth.id)
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You cannot cancel this ride"

                });

            }


            /* =========================
               CHECK RIDE STATUS
               ========================= */

            const cancellableStatuses = [

                "SEARCHING_DRIVER",

                "DRIVER_ASSIGNED",

                "DRIVER_ARRIVING",

                "DRIVER_AT_PICKUP"

            ];


            if (
                !cancellableStatuses.includes(
                    ride.status
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "This ride cannot be cancelled now"

                });

            }


            /* =========================
               CANCEL RIDE
               ========================= */

            ride.status =
                "CANCELLED";


            ride.cancelledBy =
                "passenger";


            ride.cancelledAt =
                new Date();


            await ride.save();


            /* =========================
               RELEASE DRIVER
               ========================= */

            if (ride.driverId) {

                const driver =
                    await Driver.findOne({

                        userId:
                            ride.driverId

                    });


                if (driver) {

                    driver.activeRideId =
                        null;

                    /*
                     * Driver becomes available
                     * again after passenger cancellation.
                     */

                    driver.online =
                        true;

                    await driver.save();


                    io.to(
                        `driver:${driver.userId}`
                    ).emit(
                        "ride:update",
                        ride
                    );

                }

            }


            /* =========================
               PASSENGER UPDATE
               ========================= */

            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "ride:update",
                ride
            );


            res.json({

                success: true,

                message:
                    "Ride cancelled successfully",

                ride

            });


        } catch (error) {

            console.error(
                "Passenger cancellation error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to cancel ride"

            });

        }

    }
);


/* =========================================================
   DRIVER CANCEL RIDE
   ========================================================= */

app.post(
    "/api/rides/:id/driver-cancel",
    auth,
    async function (req, res) {

        try {

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can use this endpoint"

                });

            }


            const ride =
                await Ride.findById(
                    req.params.id
                );


            if (!ride) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Ride not found"

                });

            }


            if (
                String(ride.driverId) !==
                String(req.auth.id)
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "This ride is not assigned to you"

                });

            }


            if (
                [
                    "RIDE_COMPLETED",
                    "CANCELLED"
                ].includes(
                    ride.status
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Ride is already finished"

                });

            }


            /* =========================
               CANCEL
               ========================= */

            ride.status =
                "CANCELLED";


            ride.cancelledBy =
                "driver";


            ride.cancelledAt =
                new Date();


            await ride.save();


            /* =========================
               RELEASE DRIVER
               ========================= */

            await Driver.findOneAndUpdate(

                {
                    userId:
                        req.auth.id
                },

                {
                    $set: {

                        activeRideId:
                            null,

                        online:
                            true

                    }

                }

            );


            /* =========================
               SEND TO PASSENGER
               ========================= */

            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "ride:update",
                ride
            );


            /* =========================
               SEND TO DRIVER
               ========================= */

            io.to(
                `driver:${ride.driverId}`
            ).emit(
                "ride:update",
                ride
            );


            res.json({

                success: true,

                message:
                    "Ride cancelled successfully",

                ride

            });


        } catch (error) {

            console.error(
                "Driver cancellation error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to cancel ride"

            });

        }

    }
);


/* =========================================================
   COMPLETE RIDE
   ========================================================= */

app.post(
    "/api/rides/:id/complete",
    auth,
    async function (req, res) {

        try {

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can complete rides"

                });

            }


            const ride =
                await Ride.findById(
                    req.params.id
                );


            if (!ride) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Ride not found"

                });

            }


            if (
                String(ride.driverId) !==
                String(req.auth.id)
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "This ride is not assigned to you"

                });

            }


            if (
                ride.status !==
                "RIDE_STARTED"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Ride must be started before completion"

                });

            }


            /* =========================
               COMPLETE
               ========================= */

            ride.status =
                "RIDE_COMPLETED";


            ride.completedAt =
                new Date();


            await ride.save();


            /* =========================
               DRIVER AVAILABLE AGAIN
               ========================= */

            await Driver.findOneAndUpdate(

                {
                    userId:
                        req.auth.id
                },

                {
                    $set: {

                        activeRideId:
                            null,

                        online:
                            true

                    }

                }

            );


            /* =========================
               PASSENGER UPDATE
               ========================= */

            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "ride:update",
                ride
            );


            /* =========================
               DRIVER UPDATE
               ========================= */

            io.to(
                `driver:${ride.driverId}`
            ).emit(
                "ride:update",
                ride
            );


            res.json({

                success: true,

                message:
                    "Ride completed successfully",

                ride

            });


        } catch (error) {

            console.error(
                "Complete ride error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to complete ride"

            });

        }

    }
);


/* =========================================================
   PASSENGER HISTORY
   ========================================================= */

app.get(
    "/api/passenger/rides/history",
    auth,
    async function (req, res) {

        try {

            const rides =
                await Ride.find({

                    passengerId:
                        req.auth.id,

                    status: {
                        $in: [
                            "RIDE_COMPLETED",
                            "CANCELLED"
                        ]
                    }

                })
                .sort({
                    createdAt: -1
                });


            res.json({

                success: true,

                rides

            });


        } catch (error) {

            console.error(
                "Passenger history error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load passenger history"

            });

        }

    }
);


/* =========================================================
   DRIVER HISTORY
   ========================================================= */

app.get(
    "/api/driver/rides/history",
    auth,
    async function (req, res) {

        try {

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can access this"

                });

            }


            const rides =
                await Ride.find({

                    driverId:
                        req.auth.id,

                    status: {
                        $in: [
                            "RIDE_COMPLETED",
                            "CANCELLED"
                        ]
                    }

                })
                .sort({
                    createdAt: -1
                });


            res.json({

                success: true,

                rides

            });


        } catch (error) {

            console.error(
                "Driver history error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load driver history"

            });

        }

    }
);


/* =========================================================
   GET DRIVER DETAILS FOR PASSENGER
   ========================================================= */

app.get(
    "/api/rides/:id/driver",
    auth,
    async function (req, res) {

        try {

            const ride =
                await Ride.findById(
                    req.params.id
                );


            if (!ride) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Ride not found"

                });

            }


            if (!ride.driverId) {

                return res.json({

                    success: true,

                    driver: null

                });

            }


            const user =
                await User.findById(
                    ride.driverId
                ).select(
                    "-password"
                );


            const driver =
                await Driver.findOne({

                    userId:
                        ride.driverId

                });


            res.json({

                success: true,

                driver: {

                    id:
                        ride.driverId,

                    name:
                        driver?.name ||
                        user?.name ||
                        "Driver",

                    phone:
                        driver?.phone ||
                        user?.phone ||
                        "",

                    vehicleType:
                        driver?.vehicleType ||
                        "",

                    vehicleModel:
                        driver?.vehicleModel ||
                        "",

                    vehicleNumber:
                        driver?.vehicleNumber ||
                        "",

                    location:
                        driver?.location ||
                        ride.driverLocation ||
                        null

                }

            });


        } catch (error) {

            console.error(
                "Ride driver details error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load driver details"

            });

        }

    }
);


/* =========================================================
   SERVER HEALTH CHECK
   ========================================================= */

app.get(
    "/",
    function (req, res) {

        res.json({

            success: true,

            message:
                "GoRide backend is running",

            version:
                "2.0.0",

            time:
                new Date().toISOString()

        });

    }
);


/* =========================================================
   API HEALTH CHECK
   ========================================================= */

app.get(
    "/api/health",
    function (req, res) {

        res.json({

            success: true,

            message:
                "GoRide API is healthy",

            database:
                mongoose.connection.readyState === 1
                    ? "connected"
                    : "disconnected",

            time:
                new Date().toISOString()

        });

    }
);


/* =========================================================
   404 API HANDLER
   ========================================================= */

app.use(
    function (req, res) {

        res.status(404).json({

            success: false,

            message:
                "API endpoint not found",

            path:
                req.originalUrl

        });

    }
);


/* =========================================================
   GLOBAL ERROR HANDLER
   ========================================================= */

app.use(
    function (
        error,
        req,
        res,
        next
    ) {

        console.error(
            "Global server error:",
            error
        );


        if (res.headersSent) {

            return next(error);

        }


        res.status(500).json({

            success: false,

            message:
                error.message ||
                "Internal server error"

        });

    }
);


/* =========================================================
   SERVER START
   ========================================================= */

const PORT =
    process.env.PORT ||
    10000;


server.listen(
    PORT,
    function () {

        console.log(
            "================================================="
        );

        console.log(
            "🚗 GoRide backend started"
        );

        console.log(
            `🌐 Port: ${PORT}`
        );

        console.log(
            "📍 Nearby driver matching: ENABLED"
        );

        console.log(
            "💰 Fare calculation: ENABLED"
        );

        console.log(
            "📡 Socket.IO live tracking: ENABLED"
        );

        console.log(
            "❌ Ride cancellation: ENABLED"
        );

        console.log(
            "🏁 Ride completion: ENABLED"
        );

        console.log(
            "================================================="
        );

    }
);


/* =========================================================
   END OF SERVER.JS — PART 5/5
   ========================================================= */

            
      


