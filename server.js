import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcrypt";

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

app.get("/", (req, res) => {
  res.send("This is our backend");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
