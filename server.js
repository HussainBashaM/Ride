/* =========================================================
   GoRide Backend — Part 1/7
   SERVER + DATABASE + MODELS + AUTHENTICATION
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

const server =
    http.createServer(app);


const io =
    new Server(server, {

        cors: {

            origin: "*",

            methods: [
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE"
            ]

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
   MONGODB
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

                type:
                    mongoose.Schema.Types.ObjectId,

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


            pickup: {

                name: {

                    type: String,

                    default: ""

                },

                lat: {

                    type: Number,

                    required: true

                },

                lng: {

                    type: Number,

                    required: true

                }

            },


            destination: {

                name: {

                    type: String,

                    default: ""

                },

                lat: {

                    type: Number,

                    required: true

                },

                lng: {

                    type: Number,

                    required: true

                }

            },


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


            /* =============================================
               PASSENGER LIVE LOCATION
               ============================================= */

            passengerLocation: {

                lat: {

                    type: Number,

                    default: null

                },

                lng: {

                    type: Number,

                    default: null

                }

            },


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


            cancelledBy: {

                type: String,

                default: null

            },


            cancelledAt: {

                type: Date,

                default: null

            },


            completedAt: {

                type: Date,

                default: null

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

function auth(
    req,
    res,
    next
) {

    try {

        const header =
            req.headers.authorization ||
            "";


        if (
            !header.startsWith(
                "Bearer "
            )
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication token required"

            });

        }


        const token =
            header.substring(7);


        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        req.auth =
            decoded;


        /*
         * Keep these aliases available because
         * some older frontend code may use them.
         */

        req.user =
            decoded;


        next();


    } catch (error) {

        console.error(
            "Authentication error:",
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
   TOKEN HELPER
   ========================================================= */

function createToken(
    user
) {

    return jwt.sign(

        {

            id:
                user._id.toString(),

            role:
                user.role,

            name:
                user.name,

            phone:
                user.phone

        },

        JWT_SECRET,

        {
            expiresIn: "30d"
        }

    );

}


/* =========================================================
   REGISTER
   ========================================================= */

app.post(
    "/api/auth/register",
    async function (
        req,
        res
    ) {

        try {

            const {
                name,
                phone,
                password,
                role
            } = req.body;


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


            const normalizedPhone =
                String(phone).trim();


            const existingUser =
                await User.findOne({

                    phone:
                        normalizedPhone

                });


            if (existingUser) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Phone number already registered"

                });

            }


            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );


            const user =
                await User.create({

                    name:
                        String(name).trim(),

                    phone:
                        normalizedPhone,

                    password:
                        hashedPassword,

                    role:
                        role === "driver"
                            ? "driver"
                            : "passenger"

                });


            /* =============================================
               DRIVER PROFILE
               ============================================= */

            if (
                user.role === "driver"
            ) {

                await Driver.create({

                    userId:
                        user._id,

                    name:
                        user.name,

                    phone:
                        user.phone

                });

            }


            const token =
                createToken(
                    user
                );


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
                "Registration error:",
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
    async function (
        req,
        res
    ) {

        try {

            const {
                phone,
                password
            } = req.body;


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


            const user =
                await User.findOne({

                    phone:
                        String(phone).trim()

                });


            if (!user) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid phone or password"

                });

            }


            const passwordMatch =
                await bcrypt.compare(

                    password,

                    user.password

                );


            if (!passwordMatch) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid phone or password"

                });

            }


            const token =
                createToken(
                    user
                );


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

                }

            });


        } catch (error) {

            console.error(
                "Login error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Login failed"

            });

        }

    }
);


/* =========================================================
   CURRENT USER
   ========================================================= */

app.get(
    "/api/auth/me",
    auth,
    async function (
        req,
        res
    ) {

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


            res.json({

                success: true,

                user

            });


        } catch (error) {

            console.error(
                "Auth me error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load user"

            });

        }

    }
);


/* =========================================================
   DRIVER PROFILE GET
   ========================================================= */

app.get(
    "/api/drivers/profile",
    auth,
    async function (
        req,
        res
    ) {

        try {

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
   DRIVER PROFILE UPDATE
   ========================================================= */
app.put(
    "/api/drivers/profile",
    auth,
    async function (
        req,
        res
    ) {

        try {

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


            const {
                name,
                phone,
                licenceNumber,
                vehicleType,
                vehicleModel,
                vehicleNumber,
                registrationNumber
            } = req.body;


            if (name !== undefined) {

                driver.name =
                    String(name).trim();

            }


            if (phone !== undefined) {

                driver.phone =
                    String(phone).trim();

            }


            if (
                licenceNumber !==
                undefined
            ) {

                driver.licenceNumber =
                    String(
                        licenceNumber
                    ).trim();

            }


            if (
                vehicleType !==
                undefined
            ) {

                driver.vehicleType =
                    String(
                        vehicleType
                    ).trim();

            }


            if (
                vehicleModel !==
                undefined
            ) {

                driver.vehicleModel =
                    String(
                        vehicleModel
                    ).trim();

            }


            if (
                vehicleNumber !==
                undefined
            ) {

                driver.vehicleNumber =
                    String(
                        vehicleNumber
                    ).trim();

            }


            if (
                registrationNumber !==
                undefined
            ) {

                driver.registrationNumber =
                    String(
                        registrationNumber
                    ).trim();

            }


            await driver.save();


            /*
             * Keep User profile synchronized.
             */

            await User.findByIdAndUpdate(

                req.auth.id,

                {

                    $set: {

                        name:
                            driver.name,

                        phone:
                            driver.phone

                    }

                }

            );


            res.json({

                success: true,

                message:
                    "Driver profile updated",

                driver

            });


        } catch (error) {

            console.error(
                "Driver profile update error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to update driver profile"

            });

        }

    }
);


/* =========================================================
   END OF PART 1/7
   =========================================================


   /* =========================================================
   GoRide Backend — Part 2/7
   DRIVER ONLINE/OFFLINE + LOCATION + SOCKET ROOMS
   ========================================================= */


/* =========================================================
   DRIVER ONLINE / OFFLINE
   ========================================================= */

app.post(
    "/api/drivers/status",
    auth,
    async function (
        req,
        res
    ) {

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
                        "Only drivers can change online status"

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
               PREVENT OFFLINE DURING
               ACTIVE RIDE
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


            driver.online =
                Boolean(online);


            /* =========================
               SAVE LOCATION IF PROVIDED
               ========================= */

            if (
                location &&
                Number.isFinite(
                    Number(location.lat)
                ) &&
                Number.isFinite(
                    Number(location.lng)
                )
            ) {

                driver.location = {

                    lat:
                        Number(location.lat),

                    lng:
                        Number(location.lng)

                };

            }


            await driver.save();


            /* =========================
               DRIVER STATUS EVENT
               ========================= */

            io.emit(
                "driver:status",
                {

                    driverId:
                        driver.userId,

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
                    "Unable to update driver status"

            });

        }

    }
);


/* =========================================================
   DRIVER CURRENT LOCATION
   ========================================================= */

app.post(
    "/api/drivers/location",
    auth,
    async function (
        req,
        res
    ) {

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


            const latitude =
                Number(lat);

            const longitude =
                Number(lng);


            if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid latitude and longitude are required"

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


            driver.location = {

                lat:
                    latitude,

                lng:
                    longitude

            };


            await driver.save();


            /* =========================
               IF DRIVER HAS ACTIVE RIDE
               SAVE LOCATION THERE TOO
               ========================= */

            if (
                driver.activeRideId
            ) {

                const ride =
                    await Ride.findById(
                        driver.activeRideId
                    );


                if (ride) {

                    ride.driverLocation = {

                        lat:
                            latitude,

                        lng:
                            longitude

                    };


                    await ride.save();


                    /* =====================
                       SEND TO PASSENGER
                       ===================== */

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

                                lat:
                                    latitude,

                                lng:
                                    longitude

                            }

                        }
                    );

                }

            }


            /* =========================
               SEND DRIVER LOCATION
               TO SOCKET ROOM
               ========================= */

            io.to(
                `driver:${driver.userId}`
            ).emit(
                "driver:location",
                {

                    driverId:
                        driver.userId,

                    location: {

                        lat:
                            latitude,

                        lng:
                            longitude

                    }

                }
            );


            res.json({

                success: true,

                message:
                    "Driver location updated",

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
   GET DRIVER STATUS
   ========================================================= */

app.get(
    "/api/drivers/status",
    auth,
    async function (
        req,
        res
    ) {

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


            if (!driver) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Driver profile not found"

                });

            }


            res.json({

                success: true,

                online:
                    driver.online,

                location:
                    driver.location,

                activeRideId:
                    driver.activeRideId

            });


        } catch (error) {

            console.error(
                "Get driver status error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to get driver status"

            });

        }

    }
);


/* =========================================================
   GET ONLINE NEARBY DRIVERS
   ========================================================= */

app.get(
    "/api/drivers/nearby",
    auth,
    async function (
        req,
        res
    ) {

        try {

            const lat =
                Number(req.query.lat);

            const lng =
                Number(req.query.lng);


            const radius =
                Number(req.query.radius) ||
                10;


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid coordinates are required"

                });

            }


            const drivers =
                await Driver.find({

                    online: true,

                    activeRideId: null

                }).select(

                    "-__v"

                );


            const nearby =
                [];


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

                        lat,
                        lng,

                        driverLat,
                        driverLng

                    );


                if (
                    distance <= radius
                ) {

                    nearby.push({

                        id:
                            driver.userId,

                        name:
                            driver.name,

                        vehicleType:
                            driver.vehicleType,

                        vehicleModel:
                            driver.vehicleModel,

                        vehicleNumber:
                            driver.vehicleNumber,

                        distance:
                            Number(
                                distance.toFixed(2)
                            ),

                        location: {

                            lat:
                                driverLat,

                            lng:
                                driverLng

                        }

                    });

                }

            }


            nearby.sort(

                function (
                    a,
                    b
                ) {

                    return (
                        a.distance -
                        b.distance
                    );

                }

            );


            res.json({

                success: true,

                count:
                    nearby.length,

                drivers:
                    nearby

            });


        } catch (error) {

            console.error(
                "Nearby drivers error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to find nearby drivers"

            });

        }

    }
);


/* =========================================================
   SOCKET.IO CONNECTION
   ========================================================= */

io.on(
    "connection",
    function (socket) {

        console.log(
            "🔌 Socket connected:",
            socket.id
        );


        /* =============================================
           USER JOINS USER ROOM
           ============================================= */

        socket.on(
            "join:user",
            function (userId) {

                if (!userId) {
                    return;
                }


                const room =
                    `user:${userId}`;


                socket.join(
                    room
                );


                socket.userId =
                    String(userId);

                socket.userRole =
                    "passenger";


                console.log(
                    `👤 User joined ${room}`
                );

            }
        );


        /* =============================================
           DRIVER JOINS DRIVER ROOM
           ============================================= */

        socket.on(
            "join:driver",
            function (driverId) {

                if (!driverId) {
                    return;
                }


                const room =
                    `driver:${driverId}`;


                socket.join(
                    room
                );


                socket.driverId =
                    String(driverId);

                socket.userRole =
                    "driver";


                console.log(
                    `🚗 Driver joined ${room}`
                );

            }
        );


        /* =============================================
           GENERIC JOIN ROOM
           ============================================= */

        socket.on(
            "join",
            function (data) {

                if (
                    !data ||
                    !data.room
                ) {

                    return;

                }


                socket.join(
                    String(data.room)
                );


                console.log(
                    `📡 Socket ${socket.id} joined ${data.room}`
                );

            }
        );


        /* =============================================
           DRIVER SOCKET LOCATION
           ============================================= */

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


                    const driverLat =
                        Number(
                            data.location.lat
                        );

                    const driverLng =
                        Number(
                            data.location.lng
                        );


                    if (
                        !Number.isFinite(driverLat) ||
                        !Number.isFinite(driverLng)
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


                    driver.location = {

                        lat:
                            driverLat,

                        lng:
                            driverLng

                    };


                    await driver.save();


                    /* =================================
                       NO ACTIVE RIDE
                       ================================= */

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

                        lat:
                            driverLat,

                        lng:
                            driverLng

                    };


                    await ride.save();


                    /* =================================
                       SEND LIVE DRIVER LOCATION
                       TO PASSENGER
                       ================================= */

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

                                lat:
                                    driverLat,

                                lng:
                                    driverLng

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


        /* =============================================
           DRIVER RIDE REQUEST ACKNOWLEDGEMENT
           ============================================= */

        socket.on(
            "driver:ready",
            function (data) {

                if (
                    !data ||
                    !data.driverId
                ) {

                    return;

                }


                socket.driverId =
                    String(
                        data.driverId
                    );


                socket.join(
                    `driver:${data.driverId}`
                );


                console.log(
                    `🚗 Driver ready: ${data.driverId}`
                );

            }
        );


        /* =============================================
           SOCKET DISCONNECT
           ============================================= */

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
   END OF PART 2/7
   =========================================================

          /* =========================================================
   GoRide Backend — Part 3/7
   DISTANCE + FARE + RIDE CREATION + NEARBY MATCHING
   ========================================================= */


/* =========================================================
   DISTANCE CALCULATION
   ========================================================= */

function calculateDistance(
    lat1,
    lng1,
    lat2,
    lng2
) {

    const earthRadius =
        6371;


    const dLat =
        (
            Number(lat2) -
            Number(lat1)
        ) *
        Math.PI /
        180;


    const dLng =
        (
            Number(lng2) -
            Number(lng1)
        ) *
        Math.PI /
        180;


    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(
            Number(lat1) *
            Math.PI /
            180
        ) *

        Math.cos(
            Number(lat2) *
            Math.PI /
            180
        ) *

        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return (
        earthRadius *
        c
    );

}


/* =========================================================
   FARE CALCULATION
   ========================================================= */

function calculateFare(
    distanceKm,
    vehicleType
) {

    const distance =
        Math.max(
            0,
            Number(distanceKm) || 0
        );


    const type =
        String(
            vehicleType ||
            "Bike"
        ).toLowerCase();


    /*
     * GoRide base fares.
     *
     * You can change these later.
     */

    const rates = {

        bike: {

            base: 25,

            perKm: 5

        },

        auto: {

            base: 30,

            perKm: 8

        },

        car: {

            base: 40,

            perKm: 12

        }

    };


    const rate =
        rates[type] ||
        rates.bike;


    const fare =
        rate.base +
        (
            distance *
            rate.perKm
        );


    return Math.max(
        rate.base,
        Math.round(
            fare
        )
    );

}


/* =========================================================
   ESTIMATED TRAVEL TIME
   ========================================================= */

function calculateEstimatedTime(
    distanceKm
) {

    const distance =
        Math.max(
            0,
            Number(distanceKm) || 0
        );


    /*
     * Approximate city speed:
     * 30 km/h
     */

    const averageSpeed =
        30;


    const minutes =
        (
            distance /
            averageSpeed
        ) *
        60;


    return Math.max(
        1,
        Math.round(
            minutes
        )
    );

}


/* =========================================================
   FARE ESTIMATION API
   ========================================================= */

app.post(
    "/api/fare/estimate",
    auth,
    async function (
        req,
        res
    ) {

        try {

            const {
                pickup,
                destination,
                vehicleType
            } = req.body;


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
                Number(
                    pickup.lat
                );

            const pickupLng =
                Number(
                    pickup.lng
                );


            const destinationLat =
                Number(
                    destination.lat
                );

            const destinationLng =
                Number(
                    destination.lng
                );


            if (
                !Number.isFinite(
                    pickupLat
                ) ||

                !Number.isFinite(
                    pickupLng
                ) ||

                !Number.isFinite(
                    destinationLat
                ) ||

                !Number.isFinite(
                    destinationLng
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid pickup and destination coordinates are required"

                });

            }


            const distance =
                calculateDistance(

                    pickupLat,
                    pickupLng,

                    destinationLat,
                    destinationLng

                );


            const fare =
                calculateFare(

                    distance,

                    vehicleType

                );


            const estimatedTime =
                calculateEstimatedTime(
                    distance
                );


            res.json({

                success: true,

                distance:
                    Number(
                        distance.toFixed(2)
                    ),

                fare:

                    fare,

                estimatedTime:
                    estimatedTime,

                vehicleType:
                    vehicleType ||
                    "Bike"

            });


        } catch (error) {

            console.error(
                "Fare estimation error:",
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
   CREATE RIDE
   ========================================================= */

app.post(
    "/api/rides",
    auth,
    async function (
        req,
        res
    ) {

        try {

            const {
                pickup,
                destination,
                vehicleType
            } = req.body;


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
                Number(
                    pickup.lat
                );

            const pickupLng =
                Number(
                    pickup.lng
                );


            const destinationLat =
                Number(
                    destination.lat
                );

            const destinationLng =
                Number(
                    destination.lng
                );


            if (
                !Number.isFinite(
                    pickupLat
                ) ||

                !Number.isFinite(
                    pickupLng
                ) ||

                !Number.isFinite(
                    destinationLat
                ) ||

                !Number.isFinite(
                    destinationLng
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid pickup and destination coordinates are required"

                });

            }


            const selectedVehicle =
                vehicleType ||
                "Bike";


            /* =========================
               CALCULATE DISTANCE
               ========================= */

            const distance =
                calculateDistance(

                    pickupLat,
                    pickupLng,

                    destinationLat,
                    destinationLng

                );


            /* =========================
               CALCULATE FARE
               ========================= */

            const fare =
                calculateFare(

                    distance,

                    selectedVehicle

                );


            /* =========================
               ETA
               ========================= */

            const estimatedTime =
                calculateEstimatedTime(
                    distance
                );


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
                            "Pickup",

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
                        selectedVehicle,

                    distance:
                        Number(
                            distance.toFixed(2)
                        ),

                    estimatedTime:
                        estimatedTime,

                    fare:
                        fare,

                    passengerLocation: {

                        lat:
                            pickupLat,

                        lng:
                            pickupLng

                    },

                    driverLocation: {

                        lat:
                            null,

                        lng:
                            null

                    },

                    status:
                        "SEARCHING_DRIVER"

                });


            /* =========================
               FIND NEARBY DRIVER
               ========================= */

            const nearbyDriver =
                await findNearestDriver(

                    pickupLat,
                    pickupLng,

                    selectedVehicle

                );


            if (nearbyDriver) {

                /* =====================
                   ASSIGN DRIVER
                   ===================== */

                ride.driverId =
                    nearbyDriver.userId;


                ride.driverLocation = {

                    lat:
                        nearbyDriver.location.lat,

                    lng:
                        nearbyDriver.location.lng

                };


                ride.status =
                    "DRIVER_ASSIGNED";


                await ride.save();


                /* =====================
                   DRIVER ACTIVE RIDE
                   ===================== */

                nearbyDriver.activeRideId =
                    ride._id;


                await nearbyDriver.save();


                /* =====================
                   DRIVER NOTIFICATION
                   ===================== */

                io.to(
                    `driver:${nearbyDriver.userId}`
                ).emit(

                    "ride:request",

                    ride

                );


                io.to(
                    `driver:${nearbyDriver.userId}`
                ).emit(

                    "ride:update",

                    ride

                );


                /* =====================
                   PASSENGER NOTIFICATION
                   ===================== */

                io.to(
                    `user:${ride.passengerId}`
                ).emit(

                    "ride:update",

                    ride

                );

            } else {

                /*
                 * No driver right now.
                 * Ride remains SEARCHING_DRIVER.
                 */

                await broadcastRideRequest(
                    ride
                );

            }


            res.status(201).json({

                success: true,

                message:
                    nearbyDriver
                        ? "Driver assigned successfully"
                        : "Ride request sent to nearby drivers",

                ride

            });


        } catch (error) {

            console.error(
                "Create ride error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to book ride"

            });

        }

    }
);


/* =========================================================
   FIND NEAREST DRIVER
   ========================================================= */

async function findNearestDriver(
    pickupLat,
    pickupLng,
    vehicleType
) {

    const drivers =
        await Driver.find({

            online:
                true,

            activeRideId:
                null

        });


    let nearestDriver =
        null;


    let nearestDistance =
        Infinity;


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
            !Number.isFinite(
                driverLat
            ) ||

            !Number.isFinite(
                driverLng
            )
        ) {

            continue;

        }


        /*
         * If driver has a vehicle type,
         * prefer matching vehicle type.
         *
         * We don't reject the driver when
         * the vehicle field is missing.
         */

        if (
            vehicleType &&
            driver.vehicleType &&
            String(
                driver.vehicleType
            ).toLowerCase() !==
            String(
                vehicleType
            ).toLowerCase()
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


        /*
         * Maximum matching radius:
         * 10 km
         */

        if (
            distance > 10
        ) {

            continue;

        }


        if (
            distance <
            nearestDistance
        ) {

            nearestDistance =
                distance;

            nearestDriver =
                driver;

        }

    }


    return nearestDriver;

}


/* =========================================================
   BROADCAST RIDE REQUEST TO NEARBY DRIVERS
   ========================================================= */

async function broadcastRideRequest(
    ride
) {

    try {

        if (!ride) {
            return;
        }


        const pickupLat =
            Number(
                ride.pickup?.lat
            );

        const pickupLng =
            Number(
                ride.pickup?.lng
            );


        if (
            !Number.isFinite(
                pickupLat
            ) ||

            !Number.isFinite(
                pickupLng
            )
        ) {

            return;

        }


        const drivers =
            await Driver.find({

                online:
                    true,

                activeRideId:
                    null

            });


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
                !Number.isFinite(
                    driverLat
                ) ||

                !Number.isFinite(
                    driverLng
                )
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
                distance <= 10
            ) {

                io.to(
                    `driver:${driver.userId}`
                ).emit(

                    "ride:request",

                    {

                        ...ride.toObject(),

                        distanceToPickup:
                            Number(
                                distance.toFixed(2)
                            )

                    }

                );

            }

        }


    } catch (error) {

        console.error(
            "Broadcast ride request error:",
            error
        );

    }

}


/* =========================================================
   GET ACTIVE RIDE FOR PASSENGER
   ========================================================= */

app.get(
    "/api/rides/active",
    auth,
    async function (
        req,
        res
    ) {

        try {

            const ride =
                await Ride.findOne({

                    passengerId:
                        req.auth.id,

                    status: {

                        $nin: [

                            "RIDE_COMPLETED",

                            "CANCELLED"

                        ]

                    }

                })
                .sort({

                    createdAt:
                        -1

                });


            res.json({

                success: true,

                ride:
                    ride || null

            });


        } catch (error) {

            console.error(
                "Passenger active ride error:",
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
   GET ACTIVE RIDE FOR DRIVER
   ========================================================= */

app.get(
    "/api/driver/rides/active",
    auth,
    async function (
        req,
        res
    ) {

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

                    ride:
                        null

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


/* ======================

  /* =========================================================
   GoRide Backend — Part 4/7
   DRIVER ACCEPT + RIDE STATUS + LIVE PASSENGER LOCATION
   ========================================================= */


/* =========================================================
   DRIVER ACCEPTS RIDE
   ========================================================= */

app.post(
    "/api/rides/:id/accept",
    auth,
    async function (
        req,
        res
    ) {

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
               RIDE MUST BE AVAILABLE
               ========================= */

            if (
                ride.status !==
                "SEARCHING_DRIVER"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "This ride is no longer available"

                });

            }


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


            /* =========================
               DRIVER MUST BE ONLINE
               ========================= */

            if (!driver.online) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Go online before accepting rides"

                });

            }


            /* =========================
               DRIVER ALREADY BUSY
               ========================= */

            if (driver.activeRideId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "You already have an active ride"

                });

            }


            /* =========================
               CHECK DISTANCE
               ========================= */

            const driverLat =
                Number(
                    driver.location?.lat
                );

            const driverLng =
                Number(
                    driver.location?.lng
                );


            const pickupLat =
                Number(
                    ride.pickup?.lat
                );

            const pickupLng =
                Number(
                    ride.pickup?.lng
                );


            if (
                Number.isFinite(
                    driverLat
                ) &&

                Number.isFinite(
                    driverLng
                ) &&

                Number.isFinite(
                    pickupLat
                ) &&

                Number.isFinite(
                    pickupLng
                )
            ) {

                const distanceToPickup =
                    calculateDistance(

                        driverLat,
                        driverLng,

                        pickupLat,
                        pickupLng

                    );


                /*
                 * Driver must be within
                 * 10 km of pickup.
                 */

                if (
                    distanceToPickup > 10
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "You are too far from the pickup location",

                        distanceToPickup:
                            Number(
                                distanceToPickup.toFixed(2)
                            )

                    });

                }

            }


            /* =========================
               ASSIGN DRIVER
               ========================= */

            ride.driverId =
                driver.userId;


            ride.driverLocation = {

                lat:
                    Number.isFinite(
                        driverLat
                    )
                        ? driverLat
                        : null,

                lng:
                    Number.isFinite(
                        driverLng
                    )
                        ? driverLng
                        : null

            };


            ride.status =
                "DRIVER_ASSIGNED";


            await ride.save();


            /* =========================
               DRIVER ACTIVE RIDE
               ========================= */

            driver.activeRideId =
                ride._id;


            await driver.save();


            /* =========================
               PASSENGER SOCKET UPDATE
               ========================= */

            io.to(
                `user:${ride.passengerId}`
            ).emit(

                "ride:update",

                ride

            );


            /* =========================
               DRIVER SOCKET UPDATE
               ========================= */

            io.to(
                `driver:${driver.userId}`
            ).emit(

                "ride:update",

                ride

            );


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
                    "Unable to accept ride"

            });

        }

    }
);


/* =========================================================
   UPDATE RIDE STATUS
   ========================================================= */

app.post(
    "/api/rides/:id/status",
    auth,
    async function (
        req,
        res
    ) {

        try {

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
               DRIVER AUTHORIZATION
               ========================= */

            if (
                req.auth.role === "driver"
            ) {

                if (
                    String(
                        ride.driverId
                    ) !==
                    String(
                        req.auth.id
                    )
                ) {

                    return res.status(403).json({

                        success: false,

                        message:
                            "This ride is not assigned to you"

                    });

                }

            }


            /* =========================
               PASSENGER AUTHORIZATION
               ========================= */

            if (
                req.auth.role === "passenger"
            ) {

                if (
                    String(
                        ride.passengerId
                    ) !==
                    String(
                        req.auth.id
                    )
                ) {

                    return res.status(403).json({

                        success: false,

                        message:
                            "This ride does not belong to you"

                    });

                }

            }


            /* =========================
               STATUS TRANSITION CHECK
               ========================= */

            const currentStatus =
                ride.status;


            const transitions = {

                SEARCHING_DRIVER: [

                    "CANCELLED"

                ],

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

                ],

                RIDE_COMPLETED: [],

                CANCELLED: []

            };


            const possible =
                transitions[
                    currentStatus
                ] || [];


            if (
                !possible.includes(
                    status
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `Cannot change ride from ${currentStatus} to ${status}`

                });

            }


            /* =========================
               UPDATE STATUS
               ========================= */

            ride.status =
                status;


            /* =========================
               COMPLETION
               ========================= */

            if (
                status ===
                "RIDE_COMPLETED"
            ) {

                ride.completedAt =
                    new Date();

            }


            /* =========================
               CANCELLATION
               ========================= */

            if (
                status ===
                "CANCELLED"
            ) {

                ride.cancelledBy =
                    req.auth.role;

                ride.cancelledAt =
                    new Date();

            }


            await ride.save();


            /* =========================
               RELEASE DRIVER
               ========================= */

            if (
                (
                    status ===
                    "RIDE_COMPLETED"
                ) ||

                (
                    status ===
                    "CANCELLED"
                )
            ) {

                if (
                    ride.driverId
                ) {

                    await Driver.findOneAndUpdate(

                        {

                            userId:
                                ride.driverId

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

                }

            }


            /* =========================
               SEND UPDATE TO PASSENGER
               ========================= */

            io.to(
                `user:${ride.passengerId}`
            ).emit(

                "ride:update",

                ride

            );


            /* =========================
               SEND UPDATE TO DRIVER
               ========================= */

            if (
                ride.driverId
            ) {

                io.to(
                    `driver:${ride.driverId}`
                ).emit(

                    "ride:update",

                    ride

                );

            }


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
                    "Unable to update ride status"

            });

        }

    }
);


/* =========================================================
   DRIVER ARRIVED
   ========================================================= */

app.post(
    "/api/rides/:id/arrived",
    auth,
    async function (
        req,
        res
    ) {

        try {

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can mark arrival"

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
                String(
                    ride.driverId
                ) !==
                String(
                    req.auth.id
                )
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "This ride is not assigned to you"

                });

            }


            if (
                ride.status !==
                "DRIVER_ARRIVING"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Driver must be arriving before marking arrival"

                });

            }


            ride.status =
                "DRIVER_AT_PICKUP";


            await ride.save();


            io.to(
                `user:${ride.passengerId}`
            ).emit(

                "ride:update",

                ride

            );


            io.to(
                `driver:${ride.driverId}`
            ).emit(

                "ride:update",

                ride

            );


            res.json({

                success: true,

                message:
                    "Driver arrived at pickup",

                ride

            });


        } catch (error) {

            console.error(
                "Driver arrived error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to update arrival status"

            });

        }

    }
);


/* =========================================================
   START RIDE
   ========================================================= */

app.post(
    "/api/rides/:id/start",
    auth,
    async function (
        req,
        res
    ) {

        try {

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can start rides"

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
                String(
                    ride.driverId
                ) !==
                String(
                    req.auth.id
                )
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "This ride is not assigned to you"

                });

            }


            if (
                ride.status !==
                "DRIVER_AT_PICKUP"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Driver must arrive at pickup before starting the ride"

                });

            }


            /* =========================
               START RIDE
               ========================= */

            ride.status =
                "RIDE_STARTED";


            await ride.save();


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
                    "Ride started successfully",

                ride

            });


        } catch (error) {

            console.error(
                "Start ride error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to start ride"

            });

        }

    }
);


/* =========================================================
   DRIVER → PASSENGER LIVE LOCATION
   ========================================================= */

app.post(
    "/api/rides/:id/passenger-location",
    auth,
    async function (
        req,
        res
    ) {

        try {

            if (
                req.auth.role !== "passenger"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only passengers can send passenger location"

                });

            }


            const {
                lat,
                lng
            } = req.body;


            const latitude =
                Number(lat);

            const longitude =
                Number(lng);


            if (
                !Number.isFinite(
                    latitude
                ) ||

                !Number.isFinite(
                    longitude
                )
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
                String(
                    ride.passengerId
                ) !==
                String(
                    req.auth.id
                )
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "This ride does not belong to you"

                });

            }


            ride.passengerLocation = {

                lat:
                    latitude,

                lng:
                    longitude

            };


            await ride.save();


            /* =========================
               SEND TO DRIVER
               ========================= */

            if (
                ride.driverId
            ) {

                io.to(
                    `driver:${ride.driverId}`
                ).emit(

                    "passenger:location",

                    {

                        rideId:
                            ride._id,

                        passengerId:
                            ride.passengerId,

                        location: {

                            lat:
                                latitude,

                            lng:
                                longitude

                        }

                    }

                );

            }


            res.json({

                success: true,

                location:
                    ride.passengerLocation

            });


        } catch (error) {

            console.error(
                "Passenger ride location error:",
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
   END OF PART 4/7
   =========================================================

/* =========================================================
   GoRide Backend — Part 5/7
   CANCELLATION + COMPLETION + RIDE HISTORY
   ========================================================= */


/* =========================================================
   CANCEL RIDE
   ========================================================= */

app.post(
    "/api/rides/:id/cancel",
    auth,
    async function (
        req,
        res
    ) {

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
               CHECK USER PERMISSION
               ========================= */

            const isPassenger =
                String(
                    ride.passengerId
                ) ===
                String(
                    req.auth.id
                );


            const isDriver =
                ride.driverId &&
                String(
                    ride.driverId
                ) ===
                String(
                    req.auth.id
                );


            if (
                !isPassenger &&
                !isDriver
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You cannot cancel this ride"

                });

            }


            /* =========================
               ALREADY FINISHED
               ========================= */

            if (
                ride.status ===
                "RIDE_COMPLETED"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Completed ride cannot be cancelled"

                });

            }


            if (
                ride.status ===
                "CANCELLED"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Ride is already cancelled"

                });

            }


            /* =========================
               CANCEL RIDE
               ========================= */

            ride.status =
                "CANCELLED";


            ride.cancelledBy =
                isDriver
                    ? "driver"
                    : "passenger";


            ride.cancelledAt =
                new Date();


            await ride.save();


            /* =========================
               RELEASE DRIVER
               ========================= */

            if (
                ride.driverId
            ) {

                await Driver.findOneAndUpdate(

                    {

                        userId:
                            ride.driverId

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


            /* =========================
               DRIVER UPDATE
               ========================= */

            if (
                ride.driverId
            ) {

                io.to(
                    `driver:${ride.driverId}`
                ).emit(

                    "ride:update",

                    ride

                );

            }


            res.json({

                success: true,

                message:
                    "Ride cancelled successfully",

                ride

            });


        } catch (error) {

            console.error(
                "Cancel ride error:",
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
    async function (
        req,
        res
    ) {

        try {

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only the driver can complete the ride"

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
                String(
                    ride.driverId
                ) !==
                String(
                    req.auth.id
                )
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
                        "Ride must be started before completing"

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
   GET PASSENGER RIDE HISTORY
   ========================================================= */

app.get(
    "/api/rides/history",
    auth,
    async function (
        req,
        res
    ) {

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

                    createdAt:
                        -1

                })
                .limit(100);


            res.json({

                success: true,

                count:
                    rides.length,

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
                    "Unable to load ride history"

            });

        }

    }
);


/* =========================================================
   GET DRIVER RIDE HISTORY
   ========================================================= */

app.get(
    "/api/driver/rides/history",
    auth,
    async function (
        req,
        res
    ) {

        try {

            if (
                req.auth.role !== "driver"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only drivers can access driver history"

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

                    createdAt:
                        -1

                })
                .limit(100);


            res.json({

                success: true,

                count:
                    rides.length,

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
                    "Unable to load driver ride history"

            });

        }

    }
);


/* =========================================================
   GET SINGLE RIDE
   ========================================================= */

app.get(
    "/api/rides/:id",
    auth,
    async function (
        req,
        res
    ) {

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
               CHECK ACCESS
               ========================= */

            const passengerAccess =
                String(
                    ride.passengerId
                ) ===
                String(
                    req.auth.id
                );


            const driverAccess =
                ride.driverId &&
                String(
                    ride.driverId
                ) ===
                String(
                    req.auth.id
                );


            if (
                !passengerAccess &&
                !driverAccess
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You do not have access to this ride"

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
                    "Unable to load ride"

            });

        }

    }
);


/* =========================================================
   PASSENGER LIVE LOCATION VIA SOCKET
   ========================================================= */

io.on(
    "connection",
    function (socket) {

        socket.on(
            "passenger:location",
            async function (data) {

                try {

                    if (
                        !data ||
                        !data.rideId ||
                        !data.passengerId ||
                        !data.location
                    ) {

                        return;

                    }


                    const latitude =
                        Number(
                            data.location.lat
                        );

                    const longitude =
                        Number(
                            data.location.lng
                        );


                    if (
                        !Number.isFinite(
                            latitude
                        ) ||

                        !Number.isFinite(
                            longitude
                        )
                    ) {

                        return;

                    }


                    const ride =
                        await Ride.findById(
                            data.rideId
                        );


                    if (!ride) {
                        return;
                    }


                    if (
                        String(
                            ride.passengerId
                        ) !==
                        String(
                            data.passengerId
                        )
                    ) {

                        return;

                    }


                    ride.passengerLocation = {

                        lat:
                            latitude,

                        lng:
                            longitude

                    };


                    await ride.save();


                    /* =========================
                       SEND LOCATION TO DRIVER
                       ========================= */

                    if (
                        ride.driverId
                    ) {

                        io.to(
                            `driver:${ride.driverId}`
                        ).emit(

                            "passenger:location",

                            {

                                rideId:
                                    ride._id,

                                passengerId:
                                    ride.passengerId,

                                location: {

                                    lat:
                                        latitude,

                                    lng:
                                        longitude

                                }

                            }

                        );

                    }


                } catch (error) {

                    console.error(
                        "Socket passenger location error:",
                        error
                    );

                }

            }
        );

    }
);


/* =========================================================
   RIDE REQUEST RETRY
   ========================================================= */

async function retrySearchingRides() {

    try {

        const rides =
            await Ride.find({

                status:
                    "SEARCHING_DRIVER"

            });


        for (
            const ride of rides
        ) {

            const nearbyDriver =
                await findNearestDriver(

                    ride.pickup.lat,

                    ride.pickup.lng,

                    ride.vehicleType

                );


            if (
                nearbyDriver
            ) {

                ride.driverId =
                    nearbyDriver.userId;


                ride.driverLocation = {

                    lat:
                        nearbyDriver.location.lat,

                    lng:
                        nearbyDriver.location.lng

                };


                ride.status =
                    "DRIVER_ASSIGNED";


                await ride.save();


                nearbyDriver.activeRideId =
                    ride._id;


                await nearbyDriver.save();


                /* =========================
                   DRIVER
                   ========================= */

                io.to(
                    `driver:${nearbyDriver.userId}`
                ).emit(

                    "ride:request",

                    ride

                );


                io.to(
                    `driver:${nearbyDriver.userId}`
                ).emit(

                    "ride:update",

                    ride

                );


                /* =========================
                   PASSENGER
                   ========================= */

                io.to(
                    `user:${ride.passengerId}`
                ).emit(

                    "ride:update",

                    ride

                );

            } else {

                /*
                 * Keep searching for drivers.
                 */

                await broadcastRideRequest(
                    ride
                );

            }

        }


    } catch (error) {

        console.error(
            "Ride retry error:",
            error
        );

    }

}


/* =========================================================
   RETRY EVERY 10 SECONDS
   ========================================================= */

setInterval(

    retrySearchingRides,

    10000

);


/* =========================================================
   END OF PART 5/7
   =========================================================

   NEXT:
   PART 6/7

   • Passenger profile
   • Driver/passenger role conversion
   • Profile APIs
   • Health/status endpoints
   ========================================================= */

/* =========================================================
   GoRide Backend — Part 6/7
   PROFILE + ROLE CONVERSION + HEALTH APIs
   ========================================================= */


/* =========================================================
   GET USER PROFILE
   ========================================================= */

app.get(
    "/api/users/profile",
    auth,
    async function (
        req,
        res
    ) {

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


            res.json({

                success: true,

                user

            });


        } catch (error) {

            console.error(
                "User profile error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load profile"

            });

        }

    }
);


/* =========================================================
   UPDATE USER PROFILE
   ========================================================= */

app.put(
    "/api/users/profile",
    auth,
    async function (
        req,
        res
    ) {

        try {

            const user =
                await User.findById(
                    req.auth.id
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found"

                });

            }


            const {
                name,
                phone
            } = req.body;


            if (
                name !== undefined
            ) {

                user.name =
                    String(
                        name
                    ).trim();

            }


            if (
                phone !== undefined
            ) {

                const newPhone =
                    String(
                        phone
                    ).trim();


                const existing =
                    await User.findOne({

                        phone:
                            newPhone,

                        _id: {
                            $ne:
                                user._id
                        }

                    });


                if (existing) {

                    return res.status(409).json({

                        success: false,

                        message:
                            "Phone number already in use"

                    });

                }


                user.phone =
                    newPhone;

            }


            await user.save();


            /*
             * Keep driver profile synchronized
             * if this account is also a driver.
             */

            if (
                user.role === "driver"
            ) {

                await Driver.findOneAndUpdate(

                    {

                        userId:
                            user._id

                    },

                    {

                        $set: {

                            name:
                                user.name,

                            phone:
                                user.phone

                        }

                    }

                );

            }


            const token =
                createToken(
                    user
                );


            res.json({

                success: true,

                message:
                    "Profile updated successfully",

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
                "User profile update error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to update profile"

            });

        }

    }
);


/* =========================================================
   CONVERT PASSENGER → DRIVER
   ========================================================= */

app.post(
    "/api/users/become-driver",
    auth,
    async function (
        req,
        res
    ) {

        try {

            const user =
                await User.findById(
                    req.auth.id
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found"

                });

            }


            /* =========================
               ALREADY DRIVER
               ========================= */

            if (
                user.role === "driver"
            ) {

                return res.json({

                    success: true,

                    message:
                        "You are already a driver",

                    token:
                        createToken(
                            user
                        ),

                    user

                });

            }


            const {
                licenceNumber,
                vehicleType,
                vehicleModel,
                vehicleNumber,
                registrationNumber
            } = req.body;


            /* =========================
               BASIC DRIVER DETAILS
               ========================= */

            if (
                !licenceNumber ||
                !vehicleType ||
                !vehicleModel ||
                !vehicleNumber
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Licence number, vehicle type, vehicle model and vehicle number are required"

                });

            }


            /* =========================
               CHANGE USER ROLE
               ========================= */

            user.role =
                "driver";


            await user.save();


            /* =========================
               CREATE OR UPDATE DRIVER
               PROFILE
               ========================= */

            let driver =
                await Driver.findOne({

                    userId:
                        user._id

                });


            if (!driver) {

                driver =
                    await Driver.create({

                        userId:
                            user._id,

                        name:
                            user.name,

                        phone:
                            user.phone,

                        licenceNumber:
                            String(
                                licenceNumber
                            ).trim(),

                        vehicleType:
                            String(
                                vehicleType
                            ).trim(),

                        vehicleModel:
                            String(
                                vehicleModel
                            ).trim(),

                        vehicleNumber:
                            String(
                                vehicleNumber
                            ).trim(),

                        registrationNumber:
                            String(
                                registrationNumber ||
                                ""
                            ).trim(),

                        online:
                            false

                    });

            } else {

                driver.licenceNumber =
                    String(
                        licenceNumber
                    ).trim();

                driver.vehicleType =
                    String(
                        vehicleType
                    ).trim();

                driver.vehicleModel =
                    String(
                        vehicleModel
                    ).trim();

                driver.vehicleNumber =
                    String(
                        vehicleNumber
                    ).trim();

                driver.registrationNumber =
                    String(
                        registrationNumber ||
                        ""
                    ).trim();


                await driver.save();

            }


            const token =
                createToken(
                    user
                );


            res.json({

                success: true,

                message:
                    "Account converted to driver successfully",

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

                driver

            });


        } catch (error) {

            console.error(
                "Become driver error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to convert account to driver"

            });

        }

    }
);


/* =========================================================
   CONVERT DRIVER → PASSENGER
   ========================================================= */

app.post(
    "/api/drivers/become-passenger",
    auth,
    async function (
        req,
        res
    ) {

        try {

            const user =
                await User.findById(
                    req.auth.id
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found"

                });

            }


            /* =========================
               ALREADY PASSENGER
               ========================= */

            if (
                user.role === "passenger"
            ) {

                return res.json({

                    success: true,

                    message:
                        "You are already a passenger",

                    token:
                        createToken(
                            user
                        ),

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

            }


            /* =========================
               CHECK ACTIVE DRIVER RIDE
               ========================= */

            const driver =
                await Driver.findOne({

                    userId:
                        user._id

                });


            if (
                driver &&
                driver.activeRideId
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Complete or cancel your active ride before becoming a passenger"

                });

            }


            /* =========================
               DRIVER MUST BE OFFLINE
               ========================= */

            if (
                driver &&
                driver.online
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Go offline before becoming a passenger"

                });

            }


            user.role =
                "passenger";


            await user.save();


            const token =
                createToken(
                    user
                );


            res.json({

                success: true,

                message:
                    "Account converted to passenger successfully",

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
                "Become passenger error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to convert account to passenger"

            });

        }

    }
);


/* =========================================================
   UPDATE DRIVER LOCATION + BROADCAST
   ========================================================= */

app.put(
    "/api/drivers/location",
    auth,
    async function (
        req,
        res
    ) {

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


            const latitude =
                Number(lat);

            const longitude =
                Number(lng);


            if (
                !Number.isFinite(
                    latitude
                ) ||

                !Number.isFinite(
                    longitude
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid latitude and longitude are required"

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


            driver.location = {

                lat:
                    latitude,

                lng:
                    longitude

            };


            await driver.save();


            /* =========================
               ACTIVE RIDE
               ========================= */

            if (
                driver.activeRideId
            ) {

                const ride =
                    await Ride.findById(

                        driver.activeRideId

                    );


                if (ride) {

                    ride.driverLocation = {

                        lat:
                            latitude,

                        lng:
                            longitude

                    };


                    await ride.save();


                    io.to(
                        `user:${ride.passengerId}`
                    ).emit(

                        "driver:location",

                        {

                            rideId:
                                ride._id,

                            driverId:
                                ride.driverId,

                            location: {

                                lat:
                                    latitude,

                                lng:
                                    longitude

                            }

                        }

                    );

                }

            }


            res.json({

                success: true,

                location:
                    driver.location

            });


        } catch (error) {

            console.error(
                "PUT driver location error:",
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
   GET DRIVER PROFILE BY USER ID
   ========================================================= */

app.get(
    "/api/drivers/:userId",
    auth,
    async function (
        req,
        res
    ) {

        try {

            const driver =
                await Driver.findOne({

                    userId:
                        req.params.userId

                }).select(

                    "-__v"

                );


            if (!driver) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Driver not found"

                });

            }


            res.json({

                success: true,

                driver

            });


        } catch (error) {

            console.error(
                "Driver lookup error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load driver"

            });

        }

    }
);


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get(
    "/",
    function (
        req,
        res
    ) {

        res.json({

            success: true,

            message:
                "GoRide backend is running",

            version:
                "2.0.0",

            database:
                mongoose.connection.readyState === 1
                    ? "connected"
                    : "disconnected",

            socket:
                "enabled"

        });

    }
);


/* =========================================================
   API HEALTH CHECK
   ========================================================= */

app.get(
    "/api/health",
    function (
        req,
        res
    ) {

        res.json({

            success: true,

            message:
                "GoRide API is healthy",

            database:
                mongoose.connection.readyState === 1
                    ? "connected"
                    : "disconnected",

            timestamp:
                new Date().toISOString()

        });

    }
);


/* =========================================================
   404 API HANDLER
   ========================================================= */

app.use(
    "/api",
    function (
        req,
        res
    ) {

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
   GENERAL ERROR HANDLER
   =========================================
   
==================== */

app.use(
    function (
        error,
        req,
        res,
        next
    ) {

        console.error(
            "Unhandled server error:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        res.status(500).json({

            success: false,

            message:
                "Internal server error"

        });

    }
);


/* =========================================================
   END OF PART 6/7
   =========================================================
   
/* =========================================================
   GoRide Backend — Part 7/7
   SERVER STARTUP + DATABASE + GRACEFUL SHUTDOWN
   ========================================================= */


/* =========================================================
   START SERVER
   ========================================================= */

const PORT =
    process.env.PORT ||
    10000;


/* =========================================================
   START HTTP SERVER
   ========================================================= */

server.listen(
    PORT,
    "0.0.0.0",
    function () {

        console.log(
            "================================================="
        );

        console.log(
            "🚗 GoRide Backend Started Successfully"
        );

        console.log(
            "================================================="
        );

        console.log(
            `🌐 Port: ${PORT}`
        );

        console.log(
            `🚀 Environment: ${
                process.env.NODE_ENV ||
                "development"
            }`
        );

        console.log(
            "🔌 Socket.IO: Enabled"
        );

        console.log(
            "📍 Nearby Driver Matching: Enabled"
        );

        console.log(
            "💰 Fare Calculation: Enabled"
        );

        console.log(
            "📡 Live Driver Location: Enabled"
        );

        console.log(
            "📡 Live Passenger Location: Enabled"
        );

        console.log(
            "================================================="
        );

    }
);


/* =========================================================
   MONGODB CONNECTION EVENTS
   ========================================================= */

mongoose.connection.on(
    "connected",
    function () {

        console.log(
            "🟢 MongoDB connected"
        );

    }
);


mongoose.connection.on(
    "error",
    function (error) {

        console.error(
            "🔴 MongoDB error:",
            error
        );

    }
);


mongoose.connection.on(
    "disconnected",
    function () {

        console.log(
            "🟡 MongoDB disconnected"
        );

    }
);


/* =========================================================
   PROCESS ERROR HANDLING
   ========================================================= */

process.on(
    "unhandledRejection",
    function (reason) {

        console.error(
            "❌ Unhandled Promise Rejection:",
            reason
        );

    }
);


process.on(
    "uncaughtException",
    function (error) {

        console.error(
            "❌ Uncaught Exception:",
            error
        );

    }
);


/* =========================================================
   GRACEFUL SHUTDOWN
   ========================================================= */

async function shutdown(
    signal
) {

    console.log(
        `\n🛑 ${signal} received`
    );


    try {

        /*
         * Stop accepting new HTTP connections.
         */

        server.close(
            async function () {

                console.log(
                    "🌐 HTTP server closed"
                );


                try {

                    await mongoose.connection.close();


                    console.log(
                        "🗄️ MongoDB connection closed"
                    );


                    console.log(
                        "✅ GoRide shutdown completed"
                    );


                    process.exit(
                        0
                    );


                } catch (error) {

                    console.error(
                        "MongoDB shutdown error:",
                        error
                    );


                    process.exit(
                        1
                    );

                }

            }
        );


        /*
         * Safety timeout.
         */

        setTimeout(
            function () {

                console.error(
                    "⚠️ Forced shutdown"
                );


                process.exit(
                    1
                );

            },
            10000
        );


    } catch (error) {

        console.error(
            "Shutdown error:",
            error
        );


        process.exit(
            1
        );

    }

}


/* =========================================================
   SHUTDOWN SIGNALS
   ========================================================= */

process.on(
    "SIGTERM",
    function () {

        shutdown(
            "SIGTERM"
        );

    }
);


process.on(
    "SIGINT",
    function () {

        shutdown(
            "SIGINT"
        );

    }
);


/* =========================================================
   FINAL SERVER.JS
   =========================================================

   GoRide backend features included:

   ✅ User authentication
   ✅ Driver authentication
   ✅ MongoDB
   ✅ Driver online/offline
   ✅ Driver location
   ✅ Nearby driver matching
   ✅ Ride booking
   ✅ Fare calculation
   ✅ Fare estimation
   ✅ Driver accepts ride
   ✅ Driver arriving
   ✅ Driver arrived
   ✅ Start ride
   ✅ Complete ride
   ✅ Passenger cancellation
   ✅ Driver cancellation
   ✅ Passenger live location
   ✅ Driver live location
   ✅ Socket.IO ride updates
   ✅ Active ride
   ✅ Ride history
   ✅ Driver profile
   ✅ Passenger profile
   ✅ Passenger → Driver conversion
   ✅ Driver → Passenger conversion
   ✅ Health check
   ✅ Error handling
   ✅ Graceful shutdown

   ========================================================= */





