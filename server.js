import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcrypt";
import request from "request";
import "dotenv/config";
import { stringify } from "querystring";

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/project-mongo";
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.Promise = Promise;

const port = process.env.PORT || 8080;
const app = express();

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

// Authenticator middleware to validate access to restricted endpoints

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

//app.get("/home", authenticateUser);
// app.get("/home", (req, res) => {
//   let city = req.query.city

//   const requesturl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.WEATHER_API_KEY}`
//   request(requesturl, function(error, response, body) {
//     let data = JSON.parse(body)
//     if (response.statusCode === 200) {
//       res.send(`The weather in ${city} is ${data.weather[0].description}`)
//     } else {
//       res.send(data.message)
//     }
//   })
// });


// NOTES endpoint
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
    enum: ["accommodation","activities", "city","food n drinks", "memories","sightseeing","travel"],
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
//***GET METHOD NOTES ****/
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

/**** POST METHOD NOTES ****/
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

/**** DELETE METHOD NOTES ******/
app.delete("/notes/:notesId", authenticateUser);
app.delete("/notes/:notesId", async (req, res) => {

  //notesId is the note we want to delete
  const { notesId } = req.params
  //This is for getting the users id so the user only can delete its own notes
  let userId = req.user._id;

  try {
    const deleteNotes = await PersonalNotes.findOneAndDelete({user: userId, _id: notesId})
    
    if (deleteNotes) {
      res.status(200).json({ response: deleteNotes, success: true });
    } else {
      res.status(400).json({ message: "Note not found", success: false });
    }
  } catch (error) {
    res.status(400).json({ message: "Could not delete note", success: false });
  }
});

app.patch("/notes/:notesId", authenticateUser)
app.patch("/notes/:notesId/update", async (req, res) => {
  //notesId is the not we want to check off
  const { notesId } = req.params;
  
  try {
    const updateNote = await PersonalNotes.findByIdAndUpdate(
      { _id: notesId },
      req.body,
      { new: true }
    )
    if(updateNote) {
      res.status(200).json({ response: updateIsCompleted, success: true });
    } else {
      res.status(200).json({message: "Note not found", success: false})
    }
  } catch (error) {
    res.status(400).json({ response: error, success: false });
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

app.get("/packinglist", authenticateUser);
app.get("/packinglist", async (req, res) => {
 
  let userId = req.user._id;
 
  try {
    const list = await PackingList.find({user: userId  }).sort({ createdAt: "desc" });
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

//Need to check that the user the note that's being deleted is owed by the one deleting
app.delete("/packinglist/:notesId", authenticateUser);
app.delete("/packinglist/:notesId", async (req, res) => {

  //notesId is the note we want to delete
  const { notesId } = req.params
  //This is for getting the users id so the user only can delete its own notes
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

app.patch("/packinglist/:listId", authenticateUser);
app.patch("/packinglist/:listId/update", async (req, res) => {
  const { listId } = req.params;
   // isCompleted is on each note
  let completed = req.user.isCompleted
  let userItem = req.user._id
  const { heading, message } = req.body;

  try {
    const updateList = await PackingList.findByIdAndUpdate(
      { userItem: listId },
      {
        heading,
        message,
      },
      { new: true }
    );
    if (updateList) {
      res.status(200).json({ response: updateList, success: true });
    } else {
      res.status(400).json({ message: "Items not found", success: false });
    }
  } catch (error) {
    res.status(400).json({ message: "Could not update list", success: false });
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
