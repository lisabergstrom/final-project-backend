import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcrypt";
import "dotenv/config";


const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/project-mongo";
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.Promise = Promise;

const port = process.env.PORT || 8080;
const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    next();
  } else {
    res.status(503).json({
      error: "Service unavailable",
    });
  }
});

/********** USER SCHEMA *******************/
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

/************ REGISTER ENDPOINT ******************/
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

/************ LOGIN ENDPOINT ******************/
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
        response: "Username or password is incorrect",
        success: false,
      });
    }
  } catch (error) {
    res.status(400).json({
      message: "Invalid request",
      response: error,
      success: false,
    });
  }
});

/***Authenticator middleware to validate access to restricted endpoints**/
const authenticateUser = async (req, res, next) => {

  const accessToken = req.header("Authorization");

  try {
    const user = await User.findOne({ accessToken });
    if (user) {
      req.user = user;
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

/********* NOTES SCHEMA *******************/
const PersonalNotesSchema = new mongoose.Schema({
  heading: {
    type: String,
    required: true,
    maxlength: 50,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    minlength: 5,
    trim: true,
  },
  tags: {
    type: String,
    required: true,
    enum: ["accommodation", "activities", "city", "foodndrinks", "memories", "sightseeing", "travel"],
  },
  createAt: {
    type: Date,
    default: () => new Date(),
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

const PersonalNotes = mongoose.model("PersonalNotes", PersonalNotesSchema);

//*** NOTES ENDPOINTS ****/
app.get("/notes", authenticateUser);
app.get("/notes", async (req, res) => {

  let userId = req.user._id;

  try {
    const notes = await PersonalNotes.find({ user: userId }).sort({
      createdAt: "desc",
    });
    res.status(200).json(notes);
  } catch (err) {
    res.status(400).json({
      message: "Could not get any notes",
      error: err.errors,
      success: false,
    });
  }
});

app.post("/notes", authenticateUser);
app.post("/notes", async (req, res) => {

  const { heading, message, tags } = req.body;

  try {
    const newPersonalNotes = await new PersonalNotes({
      heading,
      message,
      tags,
      user: req.user,
    }).save();
    res.status(200).json({ response: newPersonalNotes, success: true });
  } catch (err) {
    res.status(400).json({
      message: "Invalid request",
      error: err.errors,
      success: false,
    });
  }
});

app.delete("/notes/:notesId", authenticateUser);
app.delete("/notes/:notesId", async (req, res) => {

  const { notesId } = req.params
  let userId = req.user._id;

  try {
    const deleteNotes = await PersonalNotes.findOneAndDelete({ user: userId, _id: notesId })

    if (deleteNotes) {
      res.status(200).json({ response: deleteNotes, success: true });
    } else {
      res.status(400).json({ message: "Note not found", success: false });
    }
  } catch (error) {
    res.status(400).json({ message: "Could not delete note", success: false });
  }
});

/********* PACKINGLIST SCHEMA *******************/
const PackingListSchema = new mongoose.Schema({
  heading: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 50,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  createAt: {
    type: Date,
    default: () => new Date(),
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

const PackingList = mongoose.model("PackingList", PackingListSchema);

/******** PACKINGLIST ENDPOINTS **********************/
app.get("/packinglist", authenticateUser);
app.get("/packinglist", async (req, res) => {

  let userId = req.user._id;

  try {
    const list = await PackingList.find({ user: userId }).sort({ createdAt: "desc" });
    res.status(200).json(list);
  } catch (err) {
    res.status(400).json({
      message: "Could not get the list",
      error: err.errors,
      success: false,
    });
  }
});

app.post("/packinglist", authenticateUser);
app.post("/packinglist", async (req, res) => {

  const { heading, message } = req.body;

  try {
    const newPackingList = await new PackingList({
      heading,
      message,
      user: req.user
    }).save();
    res.status(200).json(newPackingList);
  } catch (err) {
    res.status(400).json({

      message: "Could not save your packing list",
      error: err.errors,
      success: false,
    });
  }
});

app.delete("/packinglist/:notesId", authenticateUser);
app.delete("/packinglist/:notesId", async (req, res) => {

  const { notesId } = req.params
  let userId = req.user._id;

  try {
    const deleteListItems = await PackingList.findOneAndDelete({
      user: userId, _id: notesId
    });
    if (deleteListItems) {
      res.status(200).json({ response: deleteListItems, success: true });
    } else {
      res.status(400).json({ message: "List items not found", success: false });
    }
  } catch (err) {
    res.status(400).json({
      message: "Could not get the list",
      error: err.errors,
      success: false,
    });
  }
});

app.patch("/packinglist/:listId/completed", authenticateUser);
app.patch("/packinglist/:listId/completed", async (req, res) => {

  const { listId } = req.params;
  const { isCompleted } = req.body;

  try {
    const updateIsCompleted = await PackingList.findOneAndUpdate(
      { _id: listId },
      { isCompleted },
      { new: true }
    );
    res.status(200).json({ response: updateIsCompleted, success: true });
  } catch (error) {
    res.status(400).json({ response: error, success: false });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
