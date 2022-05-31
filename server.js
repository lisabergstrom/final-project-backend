import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcrypt";
import request from "request";
import dotenv from "dotenv";

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/project-mongo";
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.Promise = Promise;

const port = process.env.PORT || 8080;
const app = express();

dotenv.config();

app.use(cors());
app.use(express.json());

// Using a userSchema in order to implement validation for the password before it is hashed

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString("hex"),
  },
});

const User = mongoose.model("User", UserSchema);

// REGISTER ENDPOINT - for new users

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    let checkUsername = await User.findOne({
      username: username.toLowerCase(),
    }).exec();

    const salt = bcrypt.genSaltSync();

    if (checkUsername !== null) {
      res.status(400).json({
        response: "Username already exist",
        success: false,
      });
    } else if (password.length < 8) {
      res.status(400).json({
        response: "Password must be at least 8 characters long.",
        success: false,
      });
    } else {
      const newUser = await new User({
        username: username.toLowerCase(),
        password: bcrypt.hashSync(password, salt),
      }).save();
      res.status(201).json({
        response: {
          username: newUser.username,
          accessToken: newUser.accessToken,
          userId: newUser._id,
        },
        success: true,
      });
    }
  } catch (error) {
    res.status(400).json({
      response: error,
      success: false,
    });
  }
});

// LOGIN ENDPOINT - for already existing users

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({
      username: username.toLowerCase(),
    }).exec();

    if (user && bcrypt.compareSync(password, user.password)) {
      res.status(200).json({
        success: true,
        username: user.username,
        accessToken: user.accessToken,
        userId: user._id,
      });
    } else {
      res.status(400).json({
        response: "Username and password don't match",
        success: false,
      });
    }
  } catch (error) {
    res.status(400).json({
      response: error,
      success: false,
    });
  }
});

// Authenticator middleware to validate access to restricted endpoints

const authenticateUser = async (req, res, next) => {
  const accessToken = req.header("Authorization");
  try {
    const user = await User.findOne({ accessToken: accessToken });
    if (user) {
      next();
    } else {
      res.status(401).json({
        response: "Please log in.",
        success: false,
      });
    }
  } catch (error) {
    res.status(400).json({
      response: error,
      success: false,
    });
  }
};

app.get("/Main", authenticateUser);

app.get("/home", (req, res) => {
  let city = req.query.city;
  const request = require("request");
  request(process.env.WEATHER_API_KEY, function (error, response, body) {
    let data = JSON.parse(body);
    if (response.statusCode === 200) {
      res.send(
        `The weather in ${city} is ${data.list[0].weather[0].description}`
      );
    }
  });
});

// MAP endpoint
app.get("/map", (req, res) => {
  const mapApi =
    "https://cartes.io/api/maps/74f11ac6-0ec6-4c21-bd14-7682ace99846";
  const request = require("request");
  request(mapApi, function (error, response, body) {
    let json = JSON.parse(body);
    if (response.statusCode === 200) {
      res.send(json);
    }
  });
});

// MARKERS endpoint
app.get("/markers", (req, res) => {
  const mapApi =
    "https://cartes.io/api/maps/74f11ac6-0ec6-4c21-bd14-7682ace99846/markers";
  const request = require("request");
  request(mapApi, function (error, response, body) {
    let json = JSON.parse(body);
    if (response.statusCode === 200) {
      res.send(json);
    }
  });
});

// NOTES endpoint

const personalNotesSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 140,
    trim: true,
  },
  createAt: {
    type: Date,
    default: () => new Date(),
  },
});

const personalNotes = mongoose.model("personalNotes", personalNotesSchema);

app.get("/notes", async (req, res) => {
  try {
    const notes = await personalNotes.find().sort({ createdAt: "desc" });
    res.status(200).json(notes);
  } catch (err) {
    res.status(400).json({
      message: "Could not get any notes",
      error: err.errors,
      success: false,
    });
  }
});

app.post("/notes", async (req, res) => {
  const { message } = req.body;

  try {
    const newPersonalNotes = await new personalNotes({ message }).save();
    res.status(200).json(newPersonalNotes);
  } catch (err) {
    res.status(400).json({
      message: "Could not save your list",
      error: err.errors,
      success: false,
    });
  }
});

app.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    next();
  } else {
    res.status(503).json({
      error: "Service unavailable",
    });
  }
});

// PACKINGLIST endpoint

const packingListSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 140,
    trim: true,
  },
  createAt: {
    type: Date,
    default: () => new Date(),
  },
});

const packingList = mongoose.model("packingList", packingListSchema);

app.get("/packinglist", async (req, res) => {
  try {
    const list = await packingList.find().sort({ createdAt: "desc" });
    res.status(200).json(list);
  } catch (err) {
    res.status(400).json({
      message: "Could not get the list",
      error: err.errors,
      success: false,
    });
  }
});

app.post("/packinglist", async (req, res) => {
  const { message } = req.body;

  try {
    const newPackingList = await new packingList({ message }).save();
    res.status(200).json(newPackingList);
  } catch (err) {
    res.status(400).json({
      message: "Could not save your packing list",
      error: err.errors,
      success: false,
    });
  }
});

app.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    next();
  } else {
    res.status(503).json({
      error: "Service unavailable",
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
