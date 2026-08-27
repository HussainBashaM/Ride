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
    cors: {
        origin: "*"
    }
});


/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(cors());

app.use(express.json());

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

const MAX_DRIVER_DISTANCE_KM = 10;


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

        console.error(
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
            required: true
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

        },

        lastLocationUpdate: {
            type: Date,
            default: Date.now
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

            default:
                "SEARCHING_DRIVER"

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


    const rate =
        rates[vehicle] ||
        rates.Bike;


    return Math.round(

        rate.base +
        distance * rate.km

    );

}


/* =========================================================
   DISTANCE BETWEEN GPS POINTS
   HAVERSINE FORMULA
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
        Math.PI /
        180;

    const dLng =
        (lng2 - lng1) *
        Math.PI /
        180;


    const a =

        Math.sin(dLat / 2) *
        Math.sin(dLat / 2)

        +

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
   VALID GPS
   ========================================================= */

function validLocation(
    location
) {

    if (!location) {
        return false;
    }


    const lat =
        Number(location.lat);

    const lng =
        Number(location.lng);


    return (

        Number.isFinite(lat) &&

        Number.isFinite(lng) &&

        lat >= -90 &&
        lat <= 90 &&

        lng >= -180 &&
        lng <= 180

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
                "Register error:",
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
                            String(
                                phone || ""
                            ).trim()
                    };


            const user =
                await User.findOne(
                    query
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

                    role:
                        "driver"

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

                online:
                    false,

                location: {

                    lat: 0,

                    lng: 0

                }

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
   BECOME DRIVER
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


            user.role =
                "driver";


            await user.save();


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


            const newToken =
                tokenFor(user);


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
   FIND NEARBY DRIVERS
   ========================================================= */

async function findNearbyDrivers(
    pickupLat,
    pickupLng,
    maxDistance =
        MAX_DRIVER_DISTANCE_KM
) {

    const drivers =
        await Driver.find({

            online: true

        });


    const nearby = [];


    for (
        const driver of drivers
    ) {

        if (
            !validLocation(
                driver.location
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
            maxDistance
        ) {

            nearby.push({

                driver,

                distance:
                    driverDistance

            });

        }

    }


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
   SEND RIDE TO NEARBY DRIVERS
   ========================================================= */

async function sendRideToNearbyDrivers(
    ride
) {

    if (
        !ride ||
        !validLocation(
            ride.pickup
        )
    ) {

        return 0;

    }


    const nearbyDrivers =
        await findNearbyDrivers(

            Number(
                ride.pickup.lat
            ),

            Number(
                ride.pickup.lng
            )

        );


    for (
        const item of nearbyDrivers
    ) {

        io.to(
            `driver:${item.driver.userId}`
        ).emit(
            "ride:new",
            ride
        );

    }


    console.log(
        "Nearby drivers for ride",
        ride._id.toString(),
        ":",
        nearbyDrivers.length
    );


    return nearbyDrivers.length;

}


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


            if (
                !validLocation(
                    pickup
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


            const serverFare =
                fare(
                    rideDistance,
                    vehicleType
                );


            const ride =
                await Ride.create({

                    passengerId:
                        req.auth.id,

                    pickup: {

                        name:
                            pickup.name ||
                            "Pickup",

                        lat:
                            Number(
                                pickup.lat
                            ),

                        lng:
                            Number(
                                pickup.lng
                            )

                    },

                    destination: {

                        name:
                            destination.name ||
                            "Destination",

                        lat:
                            Number(
                                destination.lat
                            ) || undefined,

                        lng:
                            Number(
                                destination.lng
                            ) || undefined

                    },

                    vehicleType:
                        vehicleType ||
                        "Bike",

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


            const nearbyDrivers =
                await sendRideToNearbyDrivers(
                    ride
                );


            console.log(
                "New ride:",
                ride._id.toString()
            );


            res.json({

                success: true,

                ride,

                nearbyDrivers

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


            if (
                online &&
                !validLocation(
                    location
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Valid GPS location is required to go online"

                    });

            }


            const update = {

                online

            };


            if (
                validLocation(
                    location
                )
            ) {

                update.location = {

                    lat:
                        Number(
                            location.lat
                        ),

                    lng:
                        Number(
                            location.lng
                        )

                };

                update.lastLocationUpdate =
                    new Date();

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

                return res
                    .status(404)
                    .json({

                        success: false,

                        message:
                            "Driver profile not found"

                    });

            }


            /* ---------------------------------------------
               BROADCAST STATUS
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


            /* ---------------------------------------------
               WHEN DRIVER GOES ONLINE
               SEND EXISTING NEARBY RIDES
               --------------------------------------------- */

            if (
                driver.online &&
                validLocation(
                    driver.location
                )
            ) {

                const searchingRides =
                    await Ride.find({

                        status:
                            "SEARCHING_DRIVER"

                    })
                    .sort({

                        createdAt:
                            -1

                    })
                    .limit(20);


                let sentCount = 0;


                for (
                    const ride
                    of searchingRides
                ) {

                    if (
                        !validLocation(
                            ride.pickup
                        )
                    ) {

                        continue;

                    }


                    const distance =
                        distanceBetweenPoints(

                            Number(
                                driver.location.lat
                            ),

                            Number(
                                driver.location.lng
                            ),

                            Number(
                                ride.pickup.lat
                            ),

                            Number(
                                ride.pickup.lng
                            )

                        );


                    if (
                        distance <=
                        MAX_DRIVER_DISTANCE_KM
                    ) {

                        io.to(
                            `driver:${driver.userId}`
                        ).emit(
                            "ride:new",
                            ride
                        );

                        sentCount++;

                    }

                }


                console.log(

                    "Driver online:",
                    driver.userId.toString(),

                    "Nearby pending rides:",
                    sentCount

                );

            }


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

                            lat,

                            lng

                        },

                        lastLocationUpdate:
                            new Date()

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


            /* ---------------------------------------------
               IF DRIVER IS ONLINE, CHECK PENDING RIDES
               --------------------------------------------- */

            if (
                driver.online
            ) {

                const rides =
                    await Ride.find({

                        status:
                            "SEARCHING_DRIVER"

                    })
                    .sort({

                        createdAt:
                            -1

                    })
                    .limit(20);


                for (
                    const ride
                    of rides
                ) {

                    if (
                        !validLocation(
                            ride.pickup
                        )
                    ) {

                        continue;

                    }


                    const driverDistance =
                        distanceBetweenPoints(

                            lat,

                            lng,

                            Number(
                                ride.pickup.lat
                            ),

                            Number(
                                ride.pickup.lng
                            )

                        );


                    if (
                        driverDistance <=
                        MAX_DRIVER_DISTANCE_KM
                    ) {

                        io.to(
                            `driver:${driver.userId}`
                        ).emit(
                            "ride:new",
                            ride
                        );

                    }

                }

            }


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
   ACCEPT RIDE
   ========================================================= */

app.post(
    "/api/rides/:id/accept",
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
                            "Only drivers can accept rides"

                    });

            }


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


            if (
                !driver.online
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Go online before accepting rides"

                    });

            }


            /* ---------------------------------------------
               CHECK ACTIVE RIDE
               --------------------------------------------- */

            const activeRide =
                await Ride.findOne({

                    driverId:
                        req.auth.id,

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

                return res
                    .status(409)
                    .json({

                        success: false,

                        message:
                            "You already have an active ride"

                    });

            }


            /* ---------------------------------------------
               ATOMIC ACCEPT
               Only SEARCHING_DRIVER can be accepted
               --------------------------------------------- */

            const ride =
                await Ride.findOneAndUpdate(

                    {

                        _id:
                            req.params.id,

                        status:
                            "SEARCHING_DRIVER"

                    },

                    {

                        driverId:
                            req.auth.id,

                        status:
                            "DRIVER_ASSIGNED"

                    },

                    {

                        new: true

                    }

                );


            if (!ride) {

                return res
                    .status(409)
                    .json({

                        success: false,

                        message:
                            "Ride is no longer available"

                    });

            }


            /* ---------------------------------------------
               DRIVER BECOMES BUSY
               --------------------------------------------- */

            driver.online =
                false;


            await driver.save();


            /* ---------------------------------------------
               PASSENGER UPDATE
               --------------------------------------------- */

            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "ride:update",
                ride
            );


            /* ---------------------------------------------
               REMOVE RIDE FROM ALL DRIVERS
               --------------------------------------------- */

            io.emit(
                "ride:accepted",
                {

                    rideId:
                        ride._id,

                    driverId:
                        req.auth.id

                }
            );


            /* ---------------------------------------------
               DRIVER ROOM UPDATE
               --------------------------------------------- */

            io.to(
                `driver:${req.auth.id}`
            ).emit(
                "ride:update",
                ride
            );


            /* ---------------------------------------------
               DRIVER STATUS UPDATE
               --------------------------------------------- */

            io.emit(
                "driver:status",
                {

                    driverId:
                        req.auth.id,

                    online:
                        false,

                    location:
                        driver.location

                }
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
               PASSENGER CAN CANCEL
               --------------------------------------------- */

            if (
                status ===
                "CANCELLED"
            ) {

                if (
                    userId !==
                    passengerId
                ) {

                    return res
                        .status(403)
                        .json({

                            success: false,

                            message:
                                "Only the passenger can use this cancellation request"

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

                    return res
                        .status(409)
                        .json({

                            success: false,

                            message:
                                "Ride can no longer be cancelled"

                        });

                }

            }


            ride.status =
                status;


            await ride.save();


            /* ---------------------------------------------
               PASSENGER UPDATE
               --------------------------------------------- */

            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "ride:update",
                ride
            );


            /* ---------------------------------------------
               DRIVER UPDATE
               --------------------------------------------- */

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


            /* ---------------------------------------------
               GLOBAL UPDATE
               --------------------------------------------- */

            io.emit(
                "ride:update",
                ride
            );


            /* ---------------------------------------------
               IF CANCELLED, DRIVER BECOMES AVAILABLE
               --------------------------------------------- */

            if (
                status ===
                "CANCELLED" &&
                ride.driverId
            ) {

                const driver =
                    await Driver.findOneAndUpdate(

                        {

                            userId:
                                ride.driverId

                        },

                        {

                            online:
                                false

                        },

                        {

                            new:
                                true

                        }

                    );


                if (driver) {

                    io.emit(
                        "driver:status",
                        {

                            driverId:
                                driver.userId,

                            online:
                                false,

                            location:
                                driver.location

                        }
                    );

                }

            }


            /* ---------------------------------------------
               COMPLETED RIDE
               DRIVER CAN GO ONLINE AGAIN
               --------------------------------------------- */

            if (
                status ===
                "RIDE_COMPLETED" &&
                ride.driverId
            ) {

                const driver =
                    await Driver.findOneAndUpdate(

                        {

                            userId:
                                ride.driverId

                        },

                        {

                            online:
                                false

                        },

                        {

                            new:
                                true

                        }

                    );


                if (driver) {

                    io.emit(
                        "driver:status",
                        {

                            driverId:
                                driver.userId,

                            online:
                                false,

                            location:
                                driver.location

                        }
                    );

                }

            }


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
   DEDICATED CANCEL RIDE
   FIX FOR:
   "API ROUTE NOT FOUND"
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


            const userId =
                String(
                    req.auth.id
                );


            const passengerId =
                String(
                    ride.passengerId
                );


            if (
                userId !==
                passengerId
            ) {

                return res
                    .status(403)
                    .json({

                        success: false,

                        message:
                            "Only the passenger can cancel this ride"

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

                return res
                    .status(409)
                    .json({

                        success: false,

                        message:
                            "Ride can no longer be cancelled"

                    });

            }


            ride.status =
                "CANCELLED";


            await ride.save();


            /* ---------------------------------------------
               PASSENGER
               --------------------------------------------- */

            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "ride:update",
                ride
            );


            /* ---------------------------------------------
               DRIVER
               --------------------------------------------- */

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


            /* ---------------------------------------------
               ALL DRIVERS REMOVE REQUEST
               --------------------------------------------- */

            io.emit(
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
   DELETE CANCEL RIDE
   EXTRA COMPATIBILITY
   ========================================================= */

app.delete(
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


            const userId =
                String(
                    req.auth.id
                );


            if (
                userId !==
                String(
                    ride.passengerId
                )
            ) {

                return res
                    .status(403)
                    .json({

                        success: false,

                        message:
                            "Only the passenger can cancel this ride"

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

                return res
                    .status(409)
                    .json({

                        success: false,

                        message:
                            "Ride can no longer be cancelled"

                    });

            }


            ride.status =
                "CANCELLED";


            await ride.save();


            io.to(
                `user:${ride.passengerId}`
            ).emit(
                "ride:update",
                ride
            );


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


            io.emit(
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
                "Delete cancel error:",
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
   DRIVER ACTIVE RIDE
   ========================================================= */

app.get(
    "/api/drivers/active-ride",
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


            const ride =
                await Ride.findOne({

                    driverId:
                        req.auth.id,

                    status: {

                        $in: [

                            "DRIVER_ASSIGNED",

                            "DRIVER_ARRIVING",

                            "DRIVER_AT_PICKUP",

                            "RIDE_STARTED"

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


            const rides =
                await Ride.find({

                    driverId:
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

                if (!id) {
                    return;
                }


                socket.join(
                    `user:${id}`
                );


                console.log(
                    "User joined:",
                    id
                );

            }
        );


        /* ---------------------------------------------
           DRIVER ROOM
           --------------------------------------------- */

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
                    "Driver joined:",
                    id
                );

            }
        );


        /* ---------------------------------------------
           LEAVE DRIVER ROOM
           --------------------------------------------- */

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


        /* ---------------------------------------------
           DRIVER LOCATION
           --------------------------------------------- */

        socket.on(
            "driver:location",
            function (data) {

                if (!data) {
                    return;
                }


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
                    "API route not found",

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


        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        res
            .status(500)
            .json({

                success: false,

                message:
                    "Internal server error"

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


