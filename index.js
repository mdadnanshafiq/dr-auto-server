const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 7000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://drauto-4bd34.web.app",
      "https://drauto-4bd34.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// custom middleware
const logger = (req, res, next) => {
  // console.log("called:", req.host, req.originalUrl, req.method);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  // console.log("Middle", token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      // console.log(err);
      return res.status(401).send({ message: "Unauthorized" });
    }
    // console.log("Value in Token", decoded);
    req.user = decoded;
    next();
  });
};

const cookieOpt = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" ? true : false,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1o25inc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const serviceCollection = client.db("drAuto").collection("services");
    const bookingsCollection = client.db("drAuto").collection("bookings");

    //   auth
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      // console.log("user for token", user);
      const token = await jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.cookie("token", token, cookieOpt).send({ success: true });
    });
    //   require('crypto').randomBytes(64).toString('hex')

    app.post("/logout", async (req, res) => {
      const user = req.body;
      // console.log("logout", user);
      res
        .clearCookie("token", { ...cookieOpt, maxAge: 0 })
        .send({ success: true });
    });

    //   services
    app.get("/services", logger, async (req, res) => {
      const filter = req.query;
      // console.log(query);
      // const query = {
      //   price: { $lt: 100 },
      // };
      // const query = {};
      const query = {
        title: { $regex: filter.search, $options: "i" },
      };
      const options = {
        sort: {
          price: filter.sort === "asc" ? 1 : -1,
        },
      };
      const cursor = serviceCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    //   bookings

    app.get("/bookings", logger, verifyToken, async (req, res) => {
      // console.log("test", req.cookies);
      // console.log("this", req.user);
      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden!" });
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    app.put("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedBooking = req.body;

      const updateDoc = {
        $set: {
          status: updatedBooking.status,
        },
      };
      const options = { upsert: true };
      const result = await bookingsCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log(`port: ${port}`);
});
