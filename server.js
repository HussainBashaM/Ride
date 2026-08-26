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

const server =
    http.createServer(app);

const io =
    new Server(server, {
        cors: {
            origin: "*"
        }
    });


/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(cors());

app.use(
    express.json()
);

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

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "goride-dev-secret";


/* =========================================================
   MONGODB
   ========================================================= */

mongoose
    .connect(
        process.env.MONGODB_URI ||
        "mongodb://127.0.0.1:27017/goride"
    )
    .then(function () {

        console.log(
            "MongoDB connected"
        );

    })
    .catch(function (error) {

        console.log(
            "MongoDB connection skipped/error:",
            error.message
        );

    });


/* =========================================================
   USER SCHEMA
   ========================================================= */

const userSchema =
    new mongoose.Schema({

        name: String,

        email: {
            type: String,
            unique: true,
            sparse: true
        },

        phone: {
            type: String,
            unique: true,
            sparse: true
        },

        password: String,

        role: {
            type: String,
            enum: [
                "user",
                "driver",
                "admin"
            ],
            default: "user"
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

        userId:
            mongoose.Schema.Types.ObjectId,

        licenceNumber:
            String,

        vehicleType:
            String,

        vehicleModel:
            String,

        vehicleNumber:
            String,

        verificationStatus: {
            type: String,
            default: "pending"
        },

        online: {
            type: Boolean,
            default: false
        },

        location: {

            lat: Number,

            lng: Number

        }

    });


/* =========================================================
   RIDE SCHEMA
   ========================================================= */

const rideSchema =
    new mongoose.Schema({

        passengerId:
            mongoose.Schema.Types.ObjectId,

        driverId:
            mongoose.Schema.Types.ObjectId,

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

        vehicleType:
            String,

        distance:
            Number,

        estimatedTime:
            Number,

        fare:
            Number,

        status: {
            type: String,
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
            id: user._id,
            role: user.role
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

        next();

    } catch {

        res
            .status(401)
            .json({

                success: false,

                message:
                    "Invalid or expired token"

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


    return Math.round(
        r.base +
        distance * r.km
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

    const R = 6371; // Earth radius in KM

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLng =
        (lng2 - lng1) *
        Math.PI / 180;

    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(
            lat1 * Math.PI / 180
        ) *
        Math.cos(
            lat2 * Math.PI / 180
        ) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}


/* =========================================================
   HEALTH
   ========================================================= */

app.get(
    "/api/health",
    function (req, res) {

        res.json({

            success: true,

            project:
                "GoRide",

            message:
                "GoRide backend is running"

        });

    }
);


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
                    ? { email }
                    : { phone };


            if (
                await User.findOne(query)
            ) {

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

                    name,

                    email,

                    phone,

                    password:
                        passwordHash,

                    role:
                        "user"

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
                        user.role

                }

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


            const user =
                await User.findOne(
                    email
                        ? { email }
                        : { phone }
                );


            if (
                !user ||
                user.role !== role ||
                !(await bcrypt.compare(
                    password || "",
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
   GET CURRENT USER
   ========================================================= */

app.get(
    "/api/users/me",
    auth,
    async function (req, res) {

        try {

            const user =
                await User
                    .findById(req.auth.id)
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


            const existing =
                await User.findOne(
                    email
                        ? { email }
                        : { phone }
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

                    name,

                    email,

                    phone,

                    password:
                        passwordHash,

                    role:
                        "driver"

                });


            await Driver.create({

                userId:
                    user._id,

                licenceNumber,

                vehicleType,

                vehicleModel,

                vehicleNumber,

                verificationStatus:
                    "pending",

                online:
                    false

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
                        "driver"

                }

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
   BECOME DRIVER
   SAME PASSENGER ACCOUNT
   ========================================================= */

app.post(
    "/api/drivers/become",
    auth,
    async function (req, res) {

        try {

            const {
                licenceNumber,
                vehicleType,
                vehicleModel,
                vehicleNumber
            } = req.body;


            /* ---------------------------------------------
               CHECK REQUIRED DETAILS
               --------------------------------------------- */

            if (
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
                            "All driver and vehicle details are required"

                    });

            }


            /* ---------------------------------------------
               FIND EXISTING USER
               --------------------------------------------- */

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
                            "User account not found"

                    });

            }


            /* ---------------------------------------------
               CHECK IF DRIVER PROFILE ALREADY EXISTS
               --------------------------------------------- */

            let driver =
                await Driver.findOne({

                    userId:
                        user._id

                });


            if (driver) {

                return res
                    .status(409)
                    .json({

                        success: false,

                        message:
                            "This account is already a driver"

                    });

            }


            /* ---------------------------------------------
               CONVERT USER TO DRIVER
               --------------------------------------------- */

            user.role =
                "driver";


            await user.save();


            /* ---------------------------------------------
               CREATE DRIVER PROFILE
               --------------------------------------------- */

            driver =
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

                    online:
                        false,

                    location: {

                        lat: 0,

                        lng: 0

                    }

                });


            /* ---------------------------------------------
               CREATE NEW TOKEN
               --------------------------------------------- */

            const newToken =
                tokenFor(user);


            /* ---------------------------------------------
               RESPONSE
               --------------------------------------------- */

            res.json({

                success: true,

                message:
                    "Your GoRide account is now a driver account",

                token:
                    newToken,

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
                        "driver"

                },

                driver: {

                    id:
                        driver._id,

                    licenceNumber:
                        driver.licenceNumber,

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
                "Become driver error:",
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

    }
);


/* =========================================================
   CREATE RIDE
   ========================================================= */

/* =========================================================
   CREATE RIDE
   SEND ONLY TO NEARBY ONLINE DRIVERS
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


            /* ---------------------------------------------
               VALIDATE PICKUP / DESTINATION
               --------------------------------------------- */

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


            /* ---------------------------------------------
               PICKUP GPS REQUIRED
               --------------------------------------------- */

            const pickupLat =
                Number(
                    pickup.lat
                );

            const pickupLng =
                Number(
                    pickup.lng
                );


            if (
                !Number.isFinite(
                    pickupLat
                ) ||
                !Number.isFinite(
                    pickupLng
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Valid pickup latitude and longitude are required"

                    });

            }


            /* ---------------------------------------------
               DISTANCE
               --------------------------------------------- */

            const rideDistance =
                Number(distance) || 0;


            if (
                rideDistance <= 0
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Valid ride distance is required"

                    });

            }


            /* ---------------------------------------------
               SERVER SIDE FARE
               --------------------------------------------- */

            const serverFare =
                fare(
                    rideDistance,
                    vehicleType
                );


            /* ---------------------------------------------
               CREATE RIDE
               --------------------------------------------- */

            const ride =
                await Ride.create({

                    passengerId:
                        req.auth.id,

                    pickup,

                    destination,

                    vehicleType,

                    distance:
                        rideDistance,

                    estimatedTime:
                        Number(
                            estimatedTime
                        ) || 0,

                    fare:
                        serverFare,

                    status:
                        "SEARCHING_DRIVER"

                });


            /* ---------------------------------------------
               FIND ONLINE DRIVERS
               --------------------------------------------- */

            const drivers =
                await Driver.find({

                    online: true

                });


            /*
             * Maximum distance from pickup.
             *
             * 10 KM is a good starting
             * value for testing.
             */

            const MAX_DRIVER_DISTANCE =
                10;


            let nearbyDrivers = [];


            /* ---------------------------------------------
               CHECK EACH DRIVER DISTANCE
               --------------------------------------------- */

            for (
                const driver
                of drivers
            ) {

                if (
                    !driver.location ||
                    !Number.isFinite(
                        Number(
                            driver.location.lat
                        )
                    ) ||
                    !Number.isFinite(
                        Number(
                            driver.location.lng
                        )
                    )
                ) {

                    continue;
                }


                const driverDistance =
                    distanceBetweenPoints(

                        pickupLat,

                        pickupLng,

                        Number(
                            driver.location.lat
                        ),

                        Number(
                            driver.location.lng
                        )

                    );


                if (
                    driverDistance <=
                    MAX_DRIVER_DISTANCE
                ) {

                    nearbyDrivers.push({

                        driver,

                        distance:
                            driverDistance

                    });

                }

            }


            /* ---------------------------------------------
               SORT NEAREST DRIVER FIRST
               --------------------------------------------- */

            nearbyDrivers.sort(
                function (a, b) {

                    return (
                        a.distance -
                        b.distance
                    );

                }
            );


            /* ---------------------------------------------
               SEND RIDE ONLY TO NEARBY DRIVERS
               --------------------------------------------- */

            for (
                const item
                of nearbyDrivers
            ) {

                io.to(
                    `driver:${item.driver.userId}`
                ).emit(
                    "ride:new",
                    ride
                );

            }


            /* ---------------------------------------------
               LOG MATCHING INFORMATION
               --------------------------------------------- */

            console.log(
                "New ride:",
                ride._id.toString()
            );

            console.log(
                "Nearby drivers:",
                nearbyDrivers.length
            );


            for (
                const item
                of nearbyDrivers
            ) {

                console.log(

                    "Driver:",
                    item.driver.userId.toString(),

                    "Distance:",
                    item.distance.toFixed(2),
                    "KM"

                );

            }


            /* ---------------------------------------------
               RESPONSE
               --------------------------------------------- */

            res.json({

                success: true,

                ride,

                nearbyDrivers:
                    nearbyDrivers.length

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
                        createdAt:
                            -1
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
    async function (req, res) {

        try {

            /* ---------------------------------------------
               ONLY DRIVER ACCOUNTS CAN CHANGE DRIVER STATUS
               --------------------------------------------- */

            if (req.auth.role !== "driver") {

                return res
                    .status(403)
                    .json({

                        success: false,

                        message:
                            "Only driver accounts can change driver status"

                    });

            }


            const online =
                !!req.body.online;


            const location =
                req.body.location || {};


            const driver =
                await Driver.findOneAndUpdate(

                    {
                        userId:
                            req.auth.id
                    },

                    {

                        online:

                            online,

                        location: {

                            lat:
                                Number(
                                    location.lat
                                ) || 0,

                            lng:
                                Number(
                                    location.lng
                                ) || 0

                        }

                    },

                    {
                        new: true
                    }

                );


            if (!driver) {

                return res
                    .status(404)
                    .json({

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

app.post("/api/rides/:id/accept", auth, async (req, res) => {
  try {

    // Make sure the logged-in user is a driver
    if (req.auth.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can accept rides"
      });
    }

    // Find the driver profile
    const driver = await Driver.findOne({
      userId: req.auth.id
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found"
      });
    }

    // Driver must be online
    if (!driver.online) {
      return res.status(400).json({
        success: false,
        message: "Go online before accepting rides"
      });
    }

    // Accept only a searching ride
    const ride = await Ride.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "SEARCHING_DRIVER"
      },
      {
        driverId: req.auth.id,
        status: "DRIVER_ASSIGNED"
      },
      {
        new: true
      }
    );

    if (!ride) {
      return res.status(409).json({
        success: false,
        message: "Ride is no longer available"
      });
    }


    /* =====================================================
       SEND UPDATE TO PASSENGER
       ===================================================== */

    io.to(`user:${ride.passengerId}`).emit(
      "ride:update",
      ride
    );


    /* =====================================================
       SEND GLOBAL UPDATE
       ===================================================== */

    io.emit(
      "ride:update",
      ride
    );


    /* =====================================================
       RESPONSE TO DRIVER
       ===================================================== */

    res.json({
      success: true,
      ride
    });

  } catch (error) {

    console.error(
      "Accept ride error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

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


            const status =
                req.body.status;


            if (
                !allowed.includes(
                    status
                )
            ) {

                return res
                    .status(400)
                    .json({

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

                return res
                    .status(404)
                    .json({

                        success: false,

                        message:
                            "Ride not found"

                    });

            }


            /* ---------------------------------------------
               ONLY RIDE PASSENGER OR DRIVER
               --------------------------------------------- */

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

                return res
                    .status(403)
                    .json({

                        success: false,

                        message:
                            "You are not part of this ride"

                    });

            }


            /* ---------------------------------------------
               UPDATE STATUS
               --------------------------------------------- */

            ride.status =
                status;


            await ride.save();


            /* ---------------------------------------------
               SEND UPDATE TO PASSENGER
               --------------------------------------------- */

            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "ride:update",
                ride
            );


            /* ---------------------------------------------
               SEND UPDATE TO DRIVER
               --------------------------------------------- */

            if (ride.driverId) {

                io.to(
                    `driver:${ride.driverId}`
                ).emit(
                    "ride:update",
                    ride
                );

            }


            /* ---------------------------------------------
               GLOBAL UPDATE
               --------------------------------------------- */

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

                return res
                    .status(403)
                    .json({

                        success: false,

                        message:
                            "Driver account required"

                    });

            }


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

                return res
                    .status(404)
                    .json({

                        success: false,

                        message:
                            "Driver profile not found"

                    });

            }


            /* ---------------------------------------------
               SEND DRIVER LOCATION TO USERS
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

            const driver =
                await Driver.findOne({

                    userId:
                        req.auth.id

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

                driver

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
   SOCKET.IO
   ========================================================= */

io.on(
    "connection",
    function (socket) {

        console.log(
            "GoRide socket connected:",
            socket.id
        );


        /* ---------------------------------------------
           USER ROOM
           --------------------------------------------- */

        socket.on(
            "join:user",
            function (id) {

                if (!id) return;

                socket.join(
                    `user:${id}`
                );

            }
        );


        /* ---------------------------------------------
           DRIVER ROOM
           --------------------------------------------- */

        socket.on(
            "join:driver",
            function (id) {

                if (!id) return;

                socket.join(
                    `driver:${id}`
                );

            }
        );


        /* ---------------------------------------------
           DRIVER LOCATION
           --------------------------------------------- */

        socket.on(
            "driver:location",
            function (data) {

                if (!data) return;

                io.emit(
                    "driver:location",
                    data
                );

            }
        );


        /* ---------------------------------------------
           DRIVER RIDE ACCEPTED
           --------------------------------------------- */

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
                    "ride:accepted",
                    data
                );

            }
        );


        /* ---------------------------------------------
           DISCONNECT
           --------------------------------------------- */

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




