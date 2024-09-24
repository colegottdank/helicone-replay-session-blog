import { resolve } from "path";

require("dotenv").config({ path: resolve(__dirname, "../.env") });

async function main() {
  console.log("Hello from the Helicone template!");
  // Add your main logic here
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
