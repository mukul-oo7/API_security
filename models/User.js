const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    default: "",
  },
  password: {
    type: String,
    required: true,
    minlength: 6 // Minimum length for password
  },
  createdAt: {
    type: String,
    default: Date.now(),
  },
});

mongoose.model("users", UserSchema);
