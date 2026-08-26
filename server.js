require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const path = require("path");


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
            methods: ["GET", "POST"]
        }
    });


app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);


app.use(
    express.json()
);


app.use(
    express.static(
        path.join(__dirname)
    )
);


/* =========================================================
   SERVER SETTINGS
   ========================================================= */

const PORT =
    process.env.PORT || 10000;


const JWT_SECRET =
    process.env.JWT_SECRET ||
    "goride-dev-secret";


const MONGODB_URI =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/goride";


/* =========================================================
   MONGODB
   ========================================================= */

mongoose
    .connect(MONGODB_URI)
    .then(function () {

        console.log(
            "MongoDB connected"
        );

    })
    .catch(function (error) {

        console.log(
            "MongoDB connection error:",
            error.message
        );
    });


/* =========================================================
   USER SCHEMA
   ========================================================= */

const userSchema =
    new mongoose.Schema({

        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
            lowercase: true
        },

        phone: {
            type: String,
            unique: true,
            sparse: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        /*
         * Current active mode.
         *
         * We keep "role" because your
         * existing frontend uses it.
         */

        role: {
            type: String,
            enum: [
                "user",
                "driver",
                "admin"
            ],
            default: "user"
        },

        /*
         * Allows one account to have
         * both passenger and driver access.
         */

        roles: {
            type: [String],
            default: ["user"]
        },

        createdAt: {
            type: Date,
            default: Date.now
        }
    });


/* =========================================================
   DRIVER SCHEMA
   ========================================================= */

const driverSchema =
    new mongoose.Schema({

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        licenceNumber: {
            type: String,
            trim: true
        },

        vehicleType: {
            type: String,
            enum: [
                "Bike",
                "Auto",
                "Car"
            ],
            default: "Bike"
        },

        vehicleModel: {
            type: String,
            trim: true
        },

        vehicleNumber: {
            type: String,
            trim: true
        },

        verificationStatus: {
            type: String,
            enum: [
                "pending",
                "approved",
                "rejected"
            ],
            default: "pending"
        },

        online: {
            type: Boolean,
            default: false
        },

        location: {

            lat: {
                type: Number,
                default: 0
            },

            lng: {
                type: Number,
                default: 0
            }
        },

        createdAt: {
            type: Date,
            default: Date.now
        }
    });


/* =========================================================
   RIDE SCHEMA
   ========================================================= */

const rideSchema =
    new mongoose.Schema({

        passengerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        pickup: {

            name: String,
            lat: Number,
            lng: Number
        },

        destination: {

            name: String,
            lat: Number,
            lng: Number
        },

        vehicleType: {
            type: String,
            enum: [
                "Bike",
                "Auto",
                "Car"
            ],
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
            default: "SEARCHING_DRIVER"
        },

        createdAt: {
            type: Date,
            default: Date.now
        }
    });


/* =========================================================
   MODELS
   ========================================================= */

const User =
    mongoose.model(
        "User",
        userSchema
    );


const Driver =
    mongoose.model(
        "Driver",
        driverSchema
    );


const Ride =
    mongoose.model(
        "Ride",
        rideSchema
    );


/* =========================================================
   JWT
   ========================================================= */

function tokenFor(user) {

    return jwt.sign(
        {
            id: user._id.toString(),
            role: user.role,
            roles:
                Array.isArray(user.roles)
                    ? user.roles
                    : [user.role]
        },

        JWT_SECRET,

        {
            expiresIn: "7d"
        }
    );
}


/* =========================================================
   AUTH MIDDLEWARE
   ========================================================= */

function auth(
    req,
    res,
    next
) {

    const header =
        req.headers.authorization || "";


    const token =
        header.startsWith("Bearer ")
            ? header.slice(7)
            : null;


    if (!token) {

        return res
            .status(401)
            .json({
                success: false,
                message: "Login required"
            });
    }


    try {

        req.auth =
            jwt.verify(
                token,
                JWT_SECRET
            );

        next();

    } catch (error) {

        return res
            .status(401)
            .json({
                success: false,
                message:
                    "Invalid or expired token"
            });
    }
}


/* =========================================================
   DRIVER AUTH MIDDLEWARE
   ========================================================= */

async function driverAuth(
    req,
    res,
    next
) {

    try {

        if (!req.auth) {

            return res
                .status(401)
                .json({
                    success: false,
                    message: "Login required"
                });
        }


        const user =
            await User.findById(
                req.auth.id
            );


        if (!user) {

            return res
                .status(404)
                .json({
                    success: false,
                    message: "User not found"
                });
        }


        const isDriver =
            user.role === "driver" ||
            (
                Array.isArray(user.roles) &&
                user.roles.includes("driver")
            );


        if (!isDriver) {

            return res
                .status(403)
                .json({
                    success: false,
                    message:
                        "Driver access required"
                });
        }


        req.user = user;


        const driver =
            await Driver.findOne({
                userId: user._id
            });


        if (!driver) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "Driver profile not found"
                });
        }


        req.driver = driver;


        next();

    } catch (error) {

        console.error(
            "Driver auth error:",
            error
        );

        res
            .status(500)
            .json({
                success: false,
                message:
                    "Driver authentication failed"
            });
    }
}


/* =========================================================
   FARE CALCULATION
   ========================================================= */

function fare(
    distance,
    vehicle
) {

    const rates = {

        Bike: {
            base: 25,
            km: 9
        },

        Auto: {
            base: 35,
            km: 13
        },

        Car: {
            base: 55,
            km: 18
        }
    };


    const rate =
        rates[vehicle] ||
        rates.Bike;


    return Math.round(
        rate.base +
        (
            Number(distance) *
            rate.km
        )
    );
}


/* =========================================================
   HEALTH
   ========================================================= */

app.get(
    "/api/health",
    function (req, res) {

        res.json({

            success: true,

            project: "GoRide",

            message:
                "GoRide backend is running",

            version: "2.0.0"
        });
    }
);


/* =========================================================
   USER REGISTRATION
   ========================================================= */

app.post(
    "/api/auth/register",
    async function (req, res) {

        try {

            const {
                name,
                email,
                phone,
                password
            } = req.body;


            if (
                !name ||
                !password ||
                (!email && !phone)
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Name, password and email/phone are required"
                    });
            }


            const query =
                email
                    ? {
                        email:
                            email
                                .trim()
                                .toLowerCase()
                    }
                    : {
                        phone:
                            phone.trim()
                    };


            const existing =
                await User.findOne(
                    query
                );


            if (existing) {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "Account already exists"
                    });
            }


            const passwordHash =
                await bcrypt.hash(
                    password,
                    10
                );


            const user =
                await User.create({

                    name:
                        name.trim(),

                    email:
                        email
                            ? email
                                .trim()
                                .toLowerCase()
                            : undefined,

                    phone:
                        phone
                            ? phone.trim()
                            : undefined,

                    password:
                        passwordHash,

                    role: "user",

                    roles: ["user"]
                });


            res.json({

                success: true,

                token:
                    tokenFor(user),

                user: {

                    id: user._id,

                    name:
                        user.name,

                    role:
                        user.role,

                    roles:
                        user.roles
                }
            });


        } catch (error) {

            console.error(
                "Registration error:",
                error
            );


            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
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
                email,
                phone,
                password,
                role = "user"
            } = req.body;


            const identity =
                email
                    ? {
                        email:
                            email
                                .trim()
                                .toLowerCase()
                    }
                    : {
                        phone:
                            phone
                                ? phone.trim()
                                : ""
                    };


            const user =
                await User.findOne(
                    identity
                );


            if (!user) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Invalid login details"
                    });
            }


            const passwordOK =
                await bcrypt.compare(
                    password || "",
                    user.password
                );


            if (!passwordOK) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Invalid login details"
                    });
            }


            /*
             * Check requested mode.
             */

            const roles =
                Array.isArray(user.roles)
                    ? user.roles
                    : [user.role];


            if (
                role !== "admin" &&
                role !== user.role &&
                !roles.includes(role)
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            `This account is not registered as ${role}`
                    });
            }


            /*
             * Make requested role active.
             */

            if (
                role === "user" ||
                role === "driver"
            ) {

                user.role = role;

                if (!roles.includes(role)) {
                    roles.push(role);
                }

                user.roles = roles;

                await user.save();
            }


            res.json({

                success: true,

                token:
                    tokenFor(user),

                user: {

                    id:
                        user._id,

                    name:
                        user.name,

                    role:
                        user.role,

                    roles:
                        user.roles
                }
            });


        } catch (error) {

            console.error(
                "Login error:",
                error
            );


            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);


/* =========================================================
   FORGOT PASSWORD
   ========================================================= */

app.post(
    "/api/auth/forgot-password",
    async function (req, res) {

        res.json({

            success: true,

            message:
                "If the account exists, a reset request has been created. Connect an email/SMS provider for production delivery."
        });
    }
);


/* =========================================================
   RESET PASSWORD
   ========================================================= */

app.post(
    "/api/auth/reset-password",
    async function (req, res) {

        res.json({

            success: true,

            message:
                "Reset endpoint ready. Add a signed reset token/email provider for production."
        });
    }
);


/* =========================================================
   CURRENT USER
   ========================================================= */

app.get(
    "/api/users/me",
    auth,
    async function (req, res) {

        try {

            const user =
                await User
                    .findById(
                        req.auth.id
                    )
                    .select("-password");


            if (!user) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "User not found"
                    });
            }


            const driver =
                await Driver.findOne({
                    userId: user._id
                });


            res.json({

                success: true,

                user,

                driver:
                    driver || null
            });


        } catch (error) {

            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);

/* =========================================================
   DRIVER REGISTRATION
   ========================================================= */

app.post(
    "/api/drivers/register",
    async function (req, res) {

        try {

            const {
                name,
                email,
                phone,
                password,
                licenceNumber,
                vehicleType,
                vehicleModel,
                vehicleNumber
            } = req.body;


            if (
                !name ||
                !password ||
                !licenceNumber ||
                !vehicleType ||
                !vehicleModel ||
                !vehicleNumber ||
                (!email && !phone)
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Please fill all required driver details"
                    });
            }


            const query =
                email
                    ? {
                        email:
                            email
                                .trim()
                                .toLowerCase()
                    }
                    : {
                        phone:
                            phone.trim()
                    };


            const existing =
                await User.findOne(
                    query
                );


            if (existing) {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "Account already exists"
                    });
            }


            const passwordHash =
                await bcrypt.hash(
                    password,
                    10
                );


            const user =
                await User.create({

                    name:
                        name.trim(),

                    email:
                        email
                            ? email
                                .trim()
                                .toLowerCase()
                            : undefined,

                    phone:
                        phone
                            ? phone.trim()
                            : undefined,

                    password:
                        passwordHash,

                    role: "driver",

                    roles: [
                        "user",
                        "driver"
                    ]
                });


            await Driver.create({

                userId:
                    user._id,

                licenceNumber:
                    licenceNumber.trim(),

                vehicleType:
                    vehicleType,

                vehicleModel:
                    vehicleModel.trim(),

                vehicleNumber:
                    vehicleNumber.trim(),

                verificationStatus:
                    "pending",

                online: false
            });


            res.json({

                success: true,

                token:
                    tokenFor(user),

                user: {

                    id:
                        user._id,

                    name:
                        user.name,

                    role:
                        "driver",

                    roles:
                        user.roles
                }
            });


        } catch (error) {

            console.error(
                "Driver registration error:",
                error
            );


            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);


/* =========================================================
   GET DRIVER PROFILE
   ========================================================= */

app.get(
    "/api/drivers/me",
    auth,
    async function (req, res) {

        try {

            const user =
                await User
                    .findById(
                        req.auth.id
                    )
                    .select("-password");


            if (!user) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "User not found"
                    });
            }


            const driver =
                await Driver.findOne({
                    userId:
                        user._id
                });


            if (!driver) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Driver profile not found"
                    });
            }


            res.json({

                success: true,

                user,

                driver
            });


        } catch (error) {

            console.error(
                "Driver profile error:",
                error
            );


            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);


/* =========================================================
   UPDATE DRIVER PROFILE
   ========================================================= */

app.put(
    "/api/drivers/me",
    auth,
    async function (req, res) {

        try {

            const {
                name,
                phone,
                email,
                licenceNumber,
                vehicleType,
                vehicleModel,
                vehicleNumber
            } = req.body;


            const user =
                await User.findById(
                    req.auth.id
                );


            if (!user) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "User not found"
                    });
            }


            const driver =
                await Driver.findOne({
                    userId:
                        user._id
                });


            if (!driver) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Driver profile not found"
                    });
            }


            if (name) {
                user.name =
                    name.trim();
            }


            if (phone) {
                user.phone =
                    phone.trim();
            }


            if (email) {
                user.email =
                    email
                        .trim()
                        .toLowerCase();
            }


            if (licenceNumber) {
                driver.licenceNumber =
                    licenceNumber.trim();
            }


            if (vehicleType) {
                driver.vehicleType =
                    vehicleType;
            }


            if (vehicleModel) {
                driver.vehicleModel =
                    vehicleModel.trim();
            }


            if (vehicleNumber) {
                driver.vehicleNumber =
                    vehicleNumber.trim();
            }


            await user.save();
            await driver.save();


            res.json({

                success: true,

                message:
                    "Driver profile updated",

                user,

                driver
            });


        } catch (error) {

            console.error(
                "Driver update error:",
                error
            );


            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);


/* =========================================================
   SWITCH TO PASSENGER
   ========================================================= */

app.post(
    "/api/account/switch-to-passenger",
    auth,
    async function (req, res) {

        try {

            const user =
                await User.findById(
                    req.auth.id
                );


            if (!user) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "User not found"
                    });
            }


            let roles =
                Array.isArray(user.roles)
                    ? user.roles
                    : [];


            if (!roles.includes("user")) {
                roles.push("user");
            }


            user.roles = roles;
            user.role = "user";


            await user.save();


            res.json({

                success: true,

                message:
                    "Switched to passenger mode",

                token:
                    tokenFor(user),

                user: {

                    id:
                        user._id,

                    name:
                        user.name,

                    role:
                        user.role,

                    roles:
                        user.roles
                }
            });


        } catch (error) {

            console.error(
                "Switch passenger error:",
                error
            );


            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);


/* =========================================================
   SWITCH TO DRIVER
   ========================================================= */

app.post(
    "/api/account/switch-to-driver",
    auth,
    async function (req, res) {

        try {

            const user =
                await User.findById(
                    req.auth.id
                );


            if (!user) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "User not found"
                    });
            }


            const driver =
                await Driver.findOne({
                    userId:
                        user._id
                });


            /*
             * A driver profile is required.
             */

            if (!driver) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Driver profile not found. Please complete driver registration first."
                    });
            }


            let roles =
                Array.isArray(user.roles)
                    ? user.roles
                    : [];


            if (!roles.includes("user")) {
                roles.push("user");
            }


            if (!roles.includes("driver")) {
                roles.push("driver");
            }


            user.roles = roles;
            user.role = "driver";


            await user.save();


            res.json({

                success: true,

                message:
                    "Switched to driver mode",

                token:
                    tokenFor(user),

                user: {

                    id:
                        user._id,

                    name:
                        user.name,

                    role:
                        user.role,

                    roles:
                        user.roles
                },

                driver
            });


        } catch (error) {

            console.error(
                "Switch driver error:",
                error
            );


            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);


/* =========================================================
   FARE ESTIMATE
   ========================================================= */

app.post(
    "/api/rides/estimate",
    auth,
    function (req, res) {

        try {

            const distance =
                Math.max(
                    0.5,
                    Number(
                        req.body.distance
                    ) || 0
                );


            const vehicleType =
                req.body.vehicleType ||
                "Bike";


            const speed = {

                Bike: 32,

                Auto: 25,

                Car: 28

            }[vehicleType] || 30;


            const estimatedTime =
                Math.max(
                    3,
                    Math.ceil(
                        distance /
                        speed *
                        60
                    )
                );


            res.json({

                success: true,

                distance,

                estimatedTime,

                fare:
                    fare(
                        distance,
                        vehicleType
                    ),

                vehicleType
            });


        } catch (error) {

            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
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
    async function (req, res) {

        try {

            const {
                pickup,
                destination,
                vehicleType,
                distance,
                estimatedTime
            } = req.body;


            if (
                !pickup ||
                !destination
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Pickup and destination are required"
                    });
            }


            const d =
                Number(distance) || 0;


            if (d <= 0) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Valid route distance is required"
                    });
            }


            const serverFare =
                fare(
                    d,
                    vehicleType
                );


            const ride =
                await Ride.create({

                    passengerId:
                        req.auth.id,

                    pickup,

                    destination,

                    vehicleType:
                        vehicleType ||
                        "Bike",

                    distance:
                        d,

                    estimatedTime:
                        Number(
                            estimatedTime
                        ) || 0,

                    fare:
                        serverFare,

                    status:
                        "SEARCHING_DRIVER"
                });


            /*
             * Send request to all
             * connected drivers.
             */

            io.emit(
                "ride:new",
                ride
            );


            res.json({

                success: true,

                ride
            });


        } catch (error) {

            console.error(
                "Create ride error:",
                error
            );


            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);


/* =========================================================
   PASSENGER RIDE HISTORY
   ========================================================= */

app.get(
    "/api/rides/my",
    auth,
    async function (req, res) {

        try {

            const rides =
                await Ride
                    .find({
                        passengerId:
                            req.auth.id
                    })
                    .sort({
                        createdAt: -1
                    });


            res.json({

                success: true,

                rides
            });


        } catch (error) {

            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);


/* =========================================================
   DRIVER RIDE HISTORY
   ========================================================= */

app.get(
    "/api/drivers/rides",
    auth,
    driverAuth,
    async function (req, res) {

        try {

            const rides =
                await Ride
                    .find({
                        driverId:
                            req.auth.id
                    })
                    .sort({
                        createdAt: -1
                    });


            res.json({

                success: true,

                rides
            });


        } catch (error) {

            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
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
    driverAuth,
    async function (req, res) {

        try {

            const online =
                !!req.body.online;


            let location =
                req.body.location || {};


            let lat =
                Number(location.lat);


            let lng =
                Number(location.lng);


            /*
             * Prevent invalid GPS values.
             */

            if (!Number.isFinite(lat)) {
                lat = 0;
            }


            if (!Number.isFinite(lng)) {
                lng = 0;
            }


            req.driver.online =
                online;


            req.driver.location = {

                lat,

                lng
            };


            await req.driver.save();


            const statusData = {

                driverId:
                    req.driver._id,

                userId:
                    req.user._id,

                online,

                location: {

                    lat,

                    lng
                }
            };


            /*
             * Broadcast driver status.
             */

            io.emit(
                "driver:status",
                statusData
            );


            /*
             * If online, broadcast
             * current driver location.
             */

            if (online) {

                io.emit(
                    "driver:location",
                    statusData
                );
            }


            res.json({

                success: true,

                driver:
                    req.driver
            });


        } catch (error) {

            console.error(
                "Driver status error:",
                error
            );


            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);


/* =========================================================
   UPDATE DRIVER LOCATION
   ========================================================= */

app.post(
    "/api/drivers/location",
    auth,
    driverAuth,
    async function (req, res) {

        try {

            const lat =
                Number(
                    req.body.lat
                );


            const lng =
                Number(
                    req.body.lng
                );


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Invalid location"
                    });
            }


            req.driver.location = {

                lat,

                lng
            };


            await req.driver.save();


            const data = {

                driverId:
                    req.driver._id,

                userId:
                    req.user._id,

                location: {

                    lat,

                    lng
                }
            };


            io.emit(
                "driver:location",
                data
            );


            /*
             * If driver has an active ride,
             * also send location to passenger.
             */

            const activeRide =
                await Ride.findOne({

                    driverId:
                        req.user._id,

                    status: {
                        $in: [
                            "DRIVER_ASSIGNED",
                            "DRIVER_ARRIVING",
                            "DRIVER_AT_PICKUP",
                            "RIDE_STARTED"
                        ]
                    }
                });


            if (activeRide) {

                io.to(
                    `user:${activeRide.passengerId}`
                ).emit(
                    "driver:location",
                    {
                        driverId:
                            req.user._id,

                        rideId:
                            activeRide._id,

                        location: {
                            lat,
                            lng
                        }
                    }
                );
            }


            res.json({

                success: true,

                location: {

                    lat,

                    lng
                }
            });


        } catch (error) {

            console.error(
                "Driver location error:",
                error
            );


            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);


/* =========================================================
   GET ONLINE DRIVERS
   ========================================================= */

app.get(
    "/api/drivers/online",
    auth,
    async function (req, res) {

        try {

            const drivers =
                await Driver
                    .find({
                        online: true
                    })
                    .select(
                        "vehicleType vehicleModel location online"
                    );


            res.json({

                success: true,

                drivers
            });


        } catch (error) {

            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);


/* =========================================================
   ACCEPT RIDE
   ========================================================= */

app.post(
    "/api/rides/:id/accept",
    auth,
    driverAuth,
    async function (req, res) {

        try {

            /*
             * Driver must be online.
             */

            if (!req.driver.online) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Go online before accepting rides"
                    });
            }


            /*
             * Find ride.
             */

            const ride =
                await Ride.findOne({
                    _id:
                        req.params.id,

                    status:
                        "SEARCHING_DRIVER"
                });


            if (!ride) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Ride is no longer available"
                    });
            }


            /*
             * Assign driver.
             */

            ride.driverId =
                req.user._id;


            ride.status =
                "DRIVER_ASSIGNED";


            await ride.save();


            /*
             * Notify passenger.
             */

            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "ride:update",
                ride
            );


            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "ride:accepted",
                ride
            );


            /*
             * Notify all drivers that
             * this ride is no longer available.
             */

            io.emit(
                "ride:update",
                ride
            );


            res.json({

                success: true,

                ride
            });


        } catch (error) {

            console.error(
                "Accept ride error:",
                error
            );


            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
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
    async function (req, res) {

        try {

            const ride =
                await Ride.findById(
                    req.params.id
                );


            if (!ride) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Ride not found"
                    });
            }


            const isPassenger =
                ride.passengerId &&
                ride.passengerId.toString() ===
                req.auth.id;


            const isDriver =
                ride.driverId &&
                ride.driverId.toString() ===
                req.auth.id;


            if (
                !isPassenger &&
                !isDriver
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "Access denied"
                    });
            }


            res.json({

                success: true,

                ride
            });


        } catch (error) {

            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
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
    async function (req, res) {

        try {

            const allowed = [

                "DRIVER_ARRIVING",

                "DRIVER_AT_PICKUP",

                "RIDE_STARTED",

                "RIDE_COMPLETED",

                "CANCELLED"

            ];


            const newStatus =
                req.body.status;


            if (
                !allowed.includes(
                    newStatus
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Invalid status"
                    });
            }


            const ride =
                await Ride.findById(
                    req.params.id
                );


            if (!ride) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Ride not found"
                    });
            }


            const isPassenger =
                ride.passengerId &&
                ride.passengerId.toString() ===
                req.auth.id;


            const isDriver =
                ride.driverId &&
                ride.driverId.toString() ===
                req.auth.id;


            /*
             * Only passenger or assigned
             * driver can update the ride.
             */

            if (
                !isPassenger &&
                !isDriver
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "You are not part of this ride"
                    });
            }


            /*
             * Driver-specific statuses.
             */

            const driverStatuses = [

                "DRIVER_ARRIVING",

                "DRIVER_AT_PICKUP",

                "RIDE_STARTED",

                "RIDE_COMPLETED"

            ];


            if (
                driverStatuses.includes(
                    newStatus
                ) &&
                !isDriver
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "Only the driver can update this status"
                    });
            }


            /*
             * Passenger can cancel.
             */

            if (
                newStatus === "CANCELLED" &&
                !isPassenger &&
                !isDriver
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "Cancellation not allowed"
                    });
            }


            ride.status =
                newStatus;


            await ride.save();


            /*
             * Send update to passenger.
             */

            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "ride:update",
                ride
            );


            /*
             * Send update to driver.
             */

            if (ride.driverId) {

                io.to(
                    `driver:${ride.driverId}`
                ).emit(
                    "ride:update",
                    ride
                );
            }


            /*
             * Also broadcast for existing
             * frontend listeners.
             */

            io.emit(
                "ride:update",
                ride
            );


            res.json({

                success: true,

                ride
            });


        } catch (error) {

            console.error(
                "Ride status error:",
                error
            );


            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);


/* =========================================================
   CANCEL RIDE
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

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Ride not found"
                    });
            }


            const isPassenger =
                ride.passengerId.toString() ===
                req.auth.id;


            const isDriver =
                ride.driverId &&
                ride.driverId.toString() ===
                req.auth.id;


            if (
                !isPassenger &&
                !isDriver
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "Access denied"
                    });
            }


            ride.status =
                "CANCELLED";


            await ride.save();


            io.emit(
                "ride:update",
                ride
            );


            if (ride.passengerId) {

                io.to(
                    `user:${ride.passengerId}`
                ).emit(
                    "ride:cancelled",
                    ride
                );
            }


            if (ride.driverId) {

                io.to(
                    `driver:${ride.driverId}`
                ).emit(
                    "ride:cancelled",
                    ride
                );
            }


            res.json({

                success: true,

                ride
            });


        } catch (error) {

            console.error(
                "Cancel ride error:",
                error
            );


            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);


/* =========================================================
   SOCKET.IO
   ========================================================= */

io.on(
    "connection",
    function (socket) {

        console.log(
            "Socket connected:",
            socket.id
        );


        /* =================================================
           USER ROOM
           ================================================= */

        socket.on(
            "join:user",
            function (id) {

                if (!id) return;

                socket.join(
                    `user:${id}`
                );

                console.log(
                    "User joined:",
                    id
                );
            }
        );


        /* =================================================
           DRIVER ROOM
           ================================================= */

        socket.on(
            "join:driver",
            function (id) {

                if (!id) return;

                socket.join(
                    `driver:${id}`
                );

                console.log(
                    "Driver joined:",
                    id
                );
            }
        );


        /* =================================================
           DRIVER LOCATION
           ================================================= */

        socket.on(
            "driver:location",
            async function (data) {

                try {

                    if (!data) {
                        return;
                    }


                    const {
                        driverId,
                        lat,
                        lng
                    } = data;


                    if (
                        !driverId ||
                        !Number.isFinite(
                            Number(lat)
                        ) ||
                        !Number.isFinite(
                            Number(lng)
                        )
                    ) {

                        return;
                    }


                    const driver =
                        await Driver.findOne({
                            userId:
                                driverId
                        });


                    if (!driver) {
                        return;
                    }


                    driver.location = {

                        lat:
                            Number(lat),

                        lng:
                            Number(lng)
                    };


                    await driver.save();


                    const locationData = {

                        driverId,

                        location: {

                            lat:
                                Number(lat),

                            lng:
                                Number(lng)
                        }
                    };


                    /*
                     * Broadcast driver location.
                     */

                    io.emit(
                        "driver:location",
                        locationData
                    );


                    /*
                     * Find active ride.
                     */

                    const ride =
                        await Ride.findOne({

                            driverId:
                                driver.userId,

                            status: {
                                $in: [

                                    "DRIVER_ASSIGNED",

                                    "DRIVER_ARRIVING",

                                    "DRIVER_AT_PICKUP",

                                    "RIDE_STARTED"

                                ]
                            }
                        });


                    if (ride) {

                        io.to(
                            `user:${ride.passengerId}`
                        ).emit(
                            "driver:location",
                            {
                                driverId,

                                rideId:
                                    ride._id,

                                location: {

                                    lat:
                                        Number(lat),

                                    lng:
                                        Number(lng)
                                }
                            }
                        );
                    }


                } catch (error) {

                    console.error(
                        "Socket location error:",
                        error.message
                    );
                }
            }
        );


        /* =================================================
           DRIVER RIDE ACCEPTED
           ================================================= */

        socket.on(
            "driver:rideAccepted",
            function (data) {

                if (!data) return;


                if (
                    data.passengerId
                ) {

                    io.to(
                        `user:${data.passengerId}`
                    ).emit(
                        "ride:accepted",
                        data
                    );
                }
            }
        );


        /* =================================================
           DISCONNECT
           ================================================= */

        socket.on(
            "disconnect",
            function () {

                console.log(
                    "Socket disconnected:",
                    socket.id
                );
            }
        );
    }
);


/* =========================================================
   404 API HANDLER
   ========================================================= */

app.use(
    "/api",
    function (req, res) {

        res
            .status(404)
            .json({

                success: false,

                message:
                    "API route not found"
            });
    }
);


/* =========================================================
   SERVER START
   ========================================================= */

server.listen(
    PORT,
    function () {

        console.log(
            `GoRide server running on port ${PORT}`
        );

        console.log(
            `API base: https://ride-f6la.onrender.com`
        );
    }
);
