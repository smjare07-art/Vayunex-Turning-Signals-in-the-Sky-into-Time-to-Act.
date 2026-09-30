const bcrypt = require("bcrypt");
const crypto = require("crypto");
const http_status = require("http-status");
const db = require("../config/db");
const axios = require("axios");

exports.login = async (req, res) => {
  const { username, password } = req.body;

  console.log("LOGIN REQUEST:", username);

  if (!username || !password) {
    return res.status(400).json({
      message: "Provide username and password",
    });
  }

  try {
    const result = await db.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    console.log("USER FOUND:", result.rows.length);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = result.rows[0];

    console.log("USER ID:", user.id);
    console.log("ROLE:", user.role);

    const isMatch = await bcrypt.compare(password, user.password);

    console.log("PASSWORD MATCH:", isMatch);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const token = crypto.randomBytes(20).toString("hex");

    console.log("TOKEN GENERATED");

    await db.query(
      "UPDATE users SET token = $1 WHERE id = $2",
      [token, user.id]
    );

    console.log("TOKEN UPDATED");

    return res.status(200).json({
      message: "Login successful",
      token: token,
      username: user.username,
      role: user.role,
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.register = async (req, res) => {
  const { username, password, role } = req.body;


  if (!username || !password || !role) {
    return res.status(400).json({
      message: "Provide username, password and role",
    });
  }

  // Allowed roles
  const allowedRoles = ["user", "admin", "rescue"];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      message: "Invalid role",
    });
  }

  try {
    // Check existing user
    const userExist = await db.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (userExist.rows.length > 0) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    // Hash password
    const hashPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await db.query(
      `INSERT INTO users (username, password, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role`,
      [username, hashPassword, role]
    );

    const user = result.rows[0];

    // Generate login token automatically
    const token = crypto.randomBytes(20).toString("hex");

    // Save token
    await db.query(
      "UPDATE users SET token = $1 WHERE id = $2",
      [token, user.id]
    );

    console.log("REGISTER SUCCESS:", user.username);
    console.log("ROLE:", user.role);

    // Send token + role to frontend
    return res.status(201).json({
      message: "Registration successful",
      token: token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

exports.getdata = async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.windy.com/api/point-forecast/v2",
      {
        lat: 20.5937,
        lon: 78.9629,

        model: "gfs",

        parameters: [
          "temp",
          "dewpoint",
          "precip",
          "wind",
          "windGust",
          "rh",
          "pressure",
          "lclouds",
          "mclouds",
          "hclouds",
          "cape",
        ],

        levels: ["surface", "850h", "700h", "500h"],

        key: process.env.WEATHER_API_KEY,
      },
    );

    console.log("Windy API response:", response.data);

    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Windy API Error:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      message: "Unable to fetch Windy forecast",
      error: error.response?.data || error.message,
    });
  }
};
