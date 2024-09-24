// scripts/setup.js
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
const exampleEnvPath = path.join(__dirname, "..", ".env.example");

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(exampleEnvPath, envPath);
  console.log(
    ".env file created based on .env.example. Please update it with your credentials."
  );
} else {
  console.log(".env file already exists.");
}
