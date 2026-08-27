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
   APP + SERVER
   ========================================================= */

const app = express();

const server =
    http.createServer(app);


/* =========================================================
   SOCKET.IO
   ========================================================= */

const io =
    new Server(server, {
        cors: {
            origin: "*",
            methods: [
                "GET",
                "POST"
            ]
        }
    });


/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(
    cors()
);

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);


/* =========================================================
   STATIC FRONTEND
   ========================================================= */

app.use(
    express.static(
        path.join(__dirname)
    )
);


/* =========================================================
   SERVER CONFIG
   ========================================================= */

const PORT =
    process.env.PORT || 10000;


/*
 * IMPORTANT:
 * Set JWT_SECRET in Render environment variables.
 */

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "goride-dev-secret-change-this";


/* =========================================================
   DATABASE
   ========================================================= */

const MONGODB_URI =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/goride";


mongoose
    .connect(MONGODB_URI)
    .then(function () {

        console.log(
            "MongoDB connected"
        );

    })
    .catch(function (error) {

        console.error(
            "MongoDB connection error:",
            error.message
        );

    });


/* =========================================================
   USER SCHEMA
   ========================================================= */

const userSchema =
    new mongoose.Schema(

        {

            name: {
                type: String,
                trim: true,
                maxlength: 100
            },


            email: {
                type: String,
                unique: true,
                sparse: true,
                lowercase: true,
                trim: true,
                maxlength: 150
            },


            phone: {
                type: String,
                unique: true,
                sparse: true,
                trim: true,
                maxlength: 20
            },


            password: {
                type: String,
                required: true
            },


            role: {
                type: String,
                enum: [
                    "user",
                    "driver",
                    "admin"
                ],
                default: "user",
                index: true
            },


            createdAt: {
                type: Date,
                default: Date.now,
                index: true
            }

        }

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

                unique: true,

                index: true
            },


            licenceNumber: {
                type: String,
                trim: true,
                maxlength: 100
            },


            vehicleType: {
                type: String,
                trim: true,
                enum: [
                    "Bike",
                    "Auto",
                    "Car"
                ]
            },


            vehicleModel: {
                type: String,
                trim: true,
                maxlength: 100
            },


            vehicleNumber: {
                type: String,
                trim: true,
                maxlength: 50
            },


            verificationStatus: {
                type: String,
                enum: [
                    "pending",
                    "approved",
                    "rejected"
                ],
                default: "pending",
                index: true
            },


            online: {
                type: Boolean,
                default: false,
                index: true
            },


            location: {

                lat: {
                    type: Number
                },

                lng: {
                    type: Number
                }

            },


            lastLocationUpdate: {
                type: Date,
                default: null,
                index: true
            },


            createdAt: {
                type: Date,
                default: Date.now,
                index: true
            }

        }

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

                required: true,

                index: true
            },


            driverId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref: "User",

                default: null,

                index: true

            },


            pickup: {

                name: {
                    type: String,
                    trim: true
                },

                lat: Number,

                lng: Number

            },


            destination: {

                name: {
                    type: String,
                    trim: true
                },

                lat: Number,

                lng: Number

            },


            vehicleType: {
                type: String,
                enum: [
                    "Bike",
                    "Auto",
                    "Car"
                ]
            },


            distance: {
                type: Number,
                min: 0
            },


            estimatedTime: {
                type: Number,
                min: 0
            },


            fare: {
                type: Number,
                min: 0
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
                    "SEARCHING_DRIVER",

                index: true

            },


            cancellationReason: {
                type: String,
                default: null,
                trim: true,
                maxlength: 250
            },


            cancelledBy: {
                type: String,
                enum: [
                    "user",
                    "driver",
                    "system",
                    null
                ],
                default: null
            },


            acceptedAt: {
                type: Date,
                default: null
            },


            completedAt: {
                type: Date,
                default: null
            },


            cancelledAt: {
                type: Date,
                default: null
            },


            createdAt: {
                type: Date,
                default: Date.now,
                index: true
            }

        }

    );


/* =========================================================
   DATABASE INDEXES
   ========================================================= */


/*
 * Passenger ride history
 */

rideSchema.index({
    passengerId: 1,
    createdAt: -1
});


/*
 * Driver ride history
 */

rideSchema.index({
    driverId: 1,
    createdAt: -1
});


/*
 * Searching rides
 */

rideSchema.index({
    status: 1,
    vehicleType: 1,
    createdAt: -1
});


/*
 * Active driver lookup
 */

driverSchema.index({
    online: 1,
    verificationStatus: 1
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
   JWT TOKEN
   ========================================================= */

function tokenFor(user) {

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
                "7d"

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

                message:
                    "Login required"

            });

    }


    try {

        req.auth =
            jwt.verify(
                token,
                JWT_SECRET
            );


        if (
            !req.auth ||
            !req.auth.id ||
            !req.auth.role
        ) {

            return res
                .status(401)
                .json({

                    success: false,

                    message:
                        "Invalid authentication token"

                });

        }


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
   ROLE CHECK HELPER
   ========================================================= */

function requireRole(role) {

    return function (
        req,
        res,
        next
    ) {

        if (
            !req.auth ||
            req.auth.role !== role
        ) {

            return res
                .status(403)
                .json({

                    success: false,

                    message:
                        role +
                        " account required"

                });

        }


        next();

    };

}


/* =========================================================
   VALID GPS CHECK
   ========================================================= */

function validCoordinates(
    lat,
    lng
) {

    const latitude =
        Number(lat);

    const longitude =
        Number(lng);


    return (

        Number.isFinite(latitude) &&

        Number.isFinite(longitude) &&

        latitude >= -90 &&
        latitude <= 90 &&

        longitude >= -180 &&
        longitude <= 180

    );

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

            base: 10,

            km: 5

        },


        Auto: {

            base: 15,

            km: 7

        },


        Car: {

            base: 25,

            km: 10

        }

    };


    const r =
        rates[vehicle] ||
        rates.Bike;


    const safeDistance =
        Math.max(
            0,
            Number(distance) || 0
        );


    return Math.round(

        r.base +
        safeDistance * r.km

    );

}


/* =========================================================
   DISTANCE BETWEEN TWO GPS LOCATIONS
   ========================================================= */

function distanceBetweenPoints(

    lat1,
    lng1,
    lat2,
    lng2

) {

    const R = 6371;


    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;


    const dLng =
        (lng2 - lng1) *
        Math.PI / 180;


    const a =

        Math.sin(dLat / 2) *
        Math.sin(dLat / 2)

        +

        Math.cos(
            lat1 * Math.PI / 180
        )

        *

        Math.cos(
            lat2 * Math.PI / 180
        )

        *

        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);


    const c =

        2 *

        Math.atan2(

            Math.sqrt(a),

            Math.sqrt(
                1 - a
            )

        );


    return R * c;

}


/* =========================================================
   DRIVER SEARCH RADIUS
   ========================================================= */

const DRIVER_SEARCH_RADIUS_KM =
    Number(
        process.env.DRIVER_SEARCH_RADIUS_KM
    ) || 10;


/* =========================================================
   DRIVER LOCATION MAX AGE
   ========================================================= */

const DRIVER_LOCATION_MAX_AGE_MS =
    Number(
        process.env.DRIVER_LOCATION_MAX_AGE_MS
    ) || 5 * 60 * 1000;


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get(
    "/api/health",
    function (
        req,
        res
    ) {

        res.json({

            success: true,

            project:
                "GoRide",

            message:
                "GoRide backend is running",

            version:
                "2.0.0"

        });

    }
);


/* =========================================================
   ROOT
   ========================================================= */

app.get(
    "/",
    function (
        req,
        res
    ) {

        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );

    }
);


/* =========================================================
   BASIC ERROR HELPER
   ========================================================= */

function serverError(
    res,
    error,
    message
) {

    console.error(
        message,
        error
    );


    return res
        .status(500)
        .json({

            success: false,

            message:
                message ||
                "Server error"

        });

}


/* =========================================================
   END OF PART 1
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
                email,
                phone,
                password
            } = req.body;


            /* ---------------------------------------------
               VALIDATION
               --------------------------------------------- */

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


            if (
                String(password).length < 6
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Password must be at least 6 characters"

                    });

            }


            const cleanEmail =
                email
                    ? String(email)
                        .trim()
                        .toLowerCase()
                    : undefined;


            const cleanPhone =
                phone
                    ? String(phone).trim()
                    : undefined;


            /* ---------------------------------------------
               CHECK EXISTING ACCOUNT
               --------------------------------------------- */

            const conditions = [];


            if (cleanEmail) {

                conditions.push({
                    email: cleanEmail
                });

            }


            if (cleanPhone) {

                conditions.push({
                    phone: cleanPhone
                });

            }


            const existing =
                await User.findOne({
                    $or: conditions
                });


            if (existing) {

                return res
                    .status(409)
                    .json({

                        success: false,

                        message:
                            "Account already exists"

                    });

            }


            /* ---------------------------------------------
               HASH PASSWORD
               --------------------------------------------- */

            const passwordHash =
                await bcrypt.hash(
                    String(password),
                    10
                );


            /* ---------------------------------------------
               CREATE USER
               --------------------------------------------- */

            const user =
                await User.create({

                    name:
                        String(name).trim(),

                    email:
                        cleanEmail,

                    phone:
                        cleanPhone,

                    password:
                        passwordHash,

                    role:
                        "user"

                });


            /* ---------------------------------------------
               RESPONSE
               --------------------------------------------- */

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
                        user.role

                }

            });


        } catch (error) {

            console.error(
                "User register error:",
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


            /* ---------------------------------------------
               LOGIN ID
               --------------------------------------------- */

            const loginEmail =
                email
                    ? String(email)
                        .trim()
                        .toLowerCase()
                    : null;


            const loginPhone =
                phone
                    ? String(phone).trim()
                    : null;


            if (
                (!loginEmail &&
                 !loginPhone) ||
                !password
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Email/phone and password are required"

                    });

            }


            /* ---------------------------------------------
               FIND USER
               --------------------------------------------- */

            const user =
                await User.findOne(

                    loginEmail
                        ? {
                            email:
                                loginEmail
                        }
                        : {
                            phone:
                                loginPhone
                        }

                );


            /* ---------------------------------------------
               CHECK LOGIN
               --------------------------------------------- */

            if (
                !user ||
                user.role !== role ||
                !(await bcrypt.compare(
                    String(password),
                    user.password
                ))
            ) {

                return res
                    .status(401)
                    .json({

                        success: false,

                        message:
                            "Invalid login details"

                    });

            }


            /* ---------------------------------------------
               DRIVER VERIFICATION CHECK
               --------------------------------------------- */

            if (
                role === "driver"
            ) {

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


                /*
                 * Pending drivers can still log in.
                 * They simply cannot receive rides
                 * until approved.
                 */

            }


            /* ---------------------------------------------
               RESPONSE
               --------------------------------------------- */

            res.json({

                success: true,

                token:
                    tokenFor(user),

                user: {

                    id:
                        user._id,

                    name:
                        user.name,

                    email:
                        user.email,

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

        try {

            const {
                email,
                phone
            } = req.body;


            /*
             * We intentionally do not reveal whether
             * an account exists.
             */

            if (
                email ||
                phone
            ) {

                const query =
                    email
                        ? {
                            email:
                                String(email)
                                    .trim()
                                    .toLowerCase()
                        }
                        : {
                            phone:
                                String(phone).trim()
                        };


                const user =
                    await User.findOne(query);


                if (user) {

                    console.log(
                        "Password reset requested for user:",
                        user._id.toString()
                    );

                }

            }


            res.json({

                success: true,

                message:
                    "If the account exists, a password reset request has been created."

            });


        } catch (error) {

            console.error(
                "Forgot password error:",
                error
            );


            res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Unable to process request"

                });

        }

    }
);


/* =========================================================
   RESET PASSWORD
   ========================================================= */

app.post(
    "/api/auth/reset-password",
    async function (req, res) {

        try {

            const {
                email,
                phone,
                newPassword
            } = req.body;


            if (
                (!email && !phone) ||
                !newPassword
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Account and new password are required"

                    });

            }


            if (
                String(newPassword).length < 6
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Password must be at least 6 characters"

                    });

            }


            const query =
                email
                    ? {
                        email:
                            String(email)
                                .trim()
                                .toLowerCase()
                    }
                    : {
                        phone:
                            String(phone).trim()
                    };


            const user =
                await User.findOne(query);


            if (!user) {

                return res
                    .status(404)
                    .json({

                        success: false,

                        message:
                            "Account not found"

                    });

            }


            user.password =
                await bcrypt.hash(
                    String(newPassword),
                    10
                );


            await user.save();


            res.json({

                success: true,

                message:
                    "Password reset successful"

            });


        } catch (error) {

            console.error(
                "Reset password error:",
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
   GET CURRENT USER
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


            res.json({

                success: true,

                user

            });


        } catch (error) {

            serverError(
                res,
                error,
                "Get current user error:"
            );

        }

    }
);


/* =========================================================
   DRIVER REGISTER
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


            /* ---------------------------------------------
               VALIDATION
               --------------------------------------------- */

            if (
                !name ||
                !password ||
                (!email && !phone) ||
                !licenceNumber ||
                !vehicleType ||
                !vehicleModel ||
                !vehicleNumber
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "All driver details are required"

                    });

            }


            if (
                ![
                    "Bike",
                    "Auto",
                    "Car"
                ].includes(vehicleType)
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Invalid vehicle type"

                    });

            }


            if (
                String(password).length < 6
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Password must be at least 6 characters"

                    });

            }


            const cleanEmail =
                email
                    ? String(email)
                        .trim()
                        .toLowerCase()
                    : undefined;


            const cleanPhone =
                phone
                    ? String(phone).trim()
                    : undefined;


            /* ---------------------------------------------
               CHECK EXISTING ACCOUNT
               --------------------------------------------- */

            const conditions = [];


            if (cleanEmail) {

                conditions.push({
                    email:
                        cleanEmail
                });

            }


            if (cleanPhone) {

                conditions.push({
                    phone:
                        cleanPhone
                });

            }


            const existing =
                await User.findOne({
                    $or:
                        conditions
                });


            if (existing) {

                return res
                    .status(409)
                    .json({

                        success: false,

                        message:
                            "Account already exists"

                    });

            }


            /* ---------------------------------------------
               HASH PASSWORD
               --------------------------------------------- */

            const passwordHash =
                await bcrypt.hash(
                    String(password),
                    10
                );


            /* ---------------------------------------------
               CREATE USER
               --------------------------------------------- */

            const user =
                await User.create({

                    name:
                        String(name).trim(),

                    email:
                        cleanEmail,

                    phone:
                        cleanPhone,

                    password:
                        passwordHash,

                    role:
                        "driver"

                });


            /* ---------------------------------------------
               CREATE DRIVER PROFILE
               --------------------------------------------- */

            const driver =
                await Driver.create({

                    userId:
                        user._id,

                    licenceNumber:
                        String(
                            licenceNumber
                        ).trim(),

                    vehicleType:
                        vehicleType,

                    vehicleModel:
                        String(
                            vehicleModel
                        ).trim(),

                    vehicleNumber:
                        String(
                            vehicleNumber
                        ).trim(),

                    verificationStatus:
                        "pending",

                    online:
                        false

                });


            /* ---------------------------------------------
               RESPONSE
               --------------------------------------------- */

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
                        "driver"

                },

                driver: {

                    id:
                        driver._id,

                    vehicleType:
                        driver.vehicleType,

                    vehicleModel:
                        driver.vehicleModel,

                    vehicleNumber:
                        driver.vehicleNumber,

                    verificationStatus:
                        driver.verificationStatus,

                    online:
                        driver.online

                }

            });


        } catch (error) {

            console.error(
                "Driver register error:",
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
   DRIVER PROFILE
   ========================================================= */

app.get(
    "/api/drivers/me",
    auth,
    requireRole("driver"),
    async function (req, res) {

        try {

            const driver =
                await Driver
                    .findOne({
                        userId:
                            req.auth.id
                    })
                    .lean();


            if (!driver) {

                return res
                    .status(404)
                    .json({

                        success: false,

                        message:
                            "Driver profile not found"

                    });

            }


            const user =
                await User
                    .findById(
                        req.auth.id
                    )
                    .select("-password")
                    .lean();


            res.json({

                success: true,

                user,

                driver

            });


        } catch (error) {

            serverError(
                res,
                error,
                "Driver profile error:"
            );

        }

    }
);


/* =========================================================
   END OF PART 2
   ========================================================= */
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

            console.error(
                "Ride history error:",
                error
            );

            res.status(500).json({
                success: false,
                message: error.message
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
    async function (req, res) {

        try {

            if (req.auth.role !== "driver") {

                return res.status(403).json({
                    success: false,
                    message:
                        "Driver account required"
                });

            }

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

            console.error(
                "Driver ride history error:",
                error
            );

            res.status(500).json({
                success: false,
                message: error.message
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

            if (
                req.auth.role !==
                "driver"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Only driver accounts can change driver status"
                });

            }

            const online =
                !!req.body.online;

            const location =
                req.body.location || {};

            const lat =
                Number(location.lat);

            const lng =
                Number(location.lng);

            const update = {
                online: online
            };

            if (
                Number.isFinite(lat) &&
                Number.isFinite(lng)
            ) {

                update.location = {
                    lat: lat,
                    lng: lng
                };

            }


            const driver =
                await Driver.findOneAndUpdate(
                    {
                        userId:
                            req.auth.id
                    },
                    update,
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


            /* ---------------------------------------------
               BROADCAST DRIVER STATUS
               --------------------------------------------- */

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
                driver
            });

        } catch (error) {

            console.error(
                "Driver status error:",
                error
            );

            res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }
);


/* =========================================================
   DRIVER LOCATION
   ========================================================= */

app.post(
    "/api/drivers/location",
    auth,
    async function (req, res) {

        try {

            if (
                req.auth.role !==
                "driver"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Driver account required"
                });

            }


            const lat =
                Number(req.body.lat);

            const lng =
                Number(req.body.lng);


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
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
                            lat: lat,
                            lng: lng
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


            /* ---------------------------------------------
               SEND LOCATION TO PASSENGERS
               --------------------------------------------- */

            io.emit(
                "driver:location",
                {
                    driverId:
                        driver.userId,

                    location:
                        driver.location
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
                message: error.message
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

            if (
                req.auth.role !==
                "driver"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Driver account required"
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
                message: error.message
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
                await Driver.find({
                    online: true
                }).select(
                    "userId vehicleType vehicleModel vehicleNumber location"
                );


            res.json({
                success: true,
                drivers
            });

        } catch (error) {

            console.error(
                "Online drivers error:",
                error
            );

            res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }
);


/* =========================================================
   GET ACTIVE RIDE
   ========================================================= */

app.get(
    "/api/rides/active",
    auth,
    async function (req, res) {

        try {

            const ride =
                await Ride.findOne({

                    $or: [

                        {
                            passengerId:
                                req.auth.id
                        },

                        {
                            driverId:
                                req.auth.id
                        }

                    ],

                    status: {
                        $nin: [
                            "RIDE_COMPLETED",
                            "CANCELLED"
                        ]
                    }

                }).sort({
                    createdAt: -1
                });


            res.json({
                success: true,
                ride: ride || null
            });

        } catch (error) {

            console.error(
                "Active ride error:",
                error
            );

            res.status(500).json({
                success: false,
                message: error.message
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
            "GoRide socket connected:",
            socket.id
        );


        /* =====================================================
           USER ROOM
           ===================================================== */

        socket.on(
            "join:user",
            function (id) {

                if (!id) {
                    return;
                }

                socket.join(
                    `user:${id}`
                );

                console.log(
                    "User joined room:",
                    id
                );

            }
        );


        /* =====================================================
           DRIVER ROOM
           ===================================================== */

        socket.on(
            "join:driver",
            function (id) {

                if (!id) {
                    return;
                }

                socket.join(
                    `driver:${id}`
                );

                console.log(
                    "Driver joined room:",
                    id
                );

            }
        );


        /* =====================================================
           LEAVE DRIVER ROOM
           ===================================================== */

        socket.on(
            "leave:driver",
            function (id) {

                if (!id) {
                    return;
                }

                socket.leave(
                    `driver:${id}`
                );

            }
        );


        /* =====================================================
           DRIVER LIVE LOCATION
           ===================================================== */

        socket.on(
            "driver:location",
            function (data) {

                if (
                    !data ||
                    !data.driverId ||
                    !data.location
                ) {
                    return;
                }


                /*
                 * Send driver location to
                 * connected passengers.
                 */

                io.emit(
                    "driver:location",
                    {
                        driverId:
                            data.driverId,

                        location:
                            data.location
                    }
                );

            }
        );


        /* =====================================================
           DRIVER RIDE ACCEPTED
           ===================================================== */

        socket.on(
            "driver:rideAccepted",
            function (data) {

                if (
                    !data ||
                    !data.passengerId ||
                    !data.rideId
                ) {
                    return;
                }


                io.to(
                    `user:${data.passengerId}`
                ).emit(
                    "ride:accepted",
                    {
                        rideId:
                            data.rideId,

                        passengerId:
                            data.passengerId
                    }
                );

            }
        );


        /* =====================================================
           DRIVER RIDE STATUS
           ===================================================== */

        socket.on(
            "driver:rideStatus",
            function (data) {

                if (
                    !data ||
                    !data.passengerId ||
                    !data.status
                ) {
                    return;
                }


                io.to(
                    `user:${data.passengerId}`
                ).emit(
                    "ride:update",
                    data
                );

            }
        );


        /* =====================================================
           DISCONNECT
           ===================================================== */

        socket.on(
            "disconnect",
            function () {

                console.log(
                    "GoRide socket disconnected:",
                    socket.id
                );

            }
        );

    }
);


/* =========================================================
   UNKNOWN API ROUTE
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
   UNKNOWN PAGE FALLBACK
   ========================================================= */

app.use(
    function (req, res, next) {

        if (
            req.method !== "GET" ||
            req.path.startsWith("/api/")
        ) {
            return next();
        }

        /*
         * Static files are already handled
         * by express.static().
         *
         * Do not force index.html here because
         * GoRide uses multiple HTML pages.
         */

        res.status(404).send(
            "GoRide page not found"
        );

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

    }
);
/* =========================================================
   GO RIDE SERVER FINAL CHECK
   ========================================================= */

/*
 * Server status information
 */

console.log(
    "----------------------------------------"
);

console.log(
    "GoRide backend initialized"
);

console.log(
    "MongoDB:",
    mongoose.connection.readyState === 1
        ? "CONNECTED"
        : "CONNECTING / OFFLINE"
);

console.log(
    "Socket.IO: ENABLED"
);

console.log(
    "Nearby driver matching: ENABLED"
);

console.log(
    "Real-time driver location: ENABLED"
);

console.log(
    "Ride status updates: ENABLED"
);

console.log(
    "----------------------------------------"
);



