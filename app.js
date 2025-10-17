import express from "express";
import debug from "debug";
import { fileURLToPath } from "url";
import * as server from "./config/server.js";
import { homeRouter } from "./routes/home.js";
import { moodTrackingRouter } from "./routes/moodTracking.js";
import { eventRouter } from "./routes/event.js";
import { socialRouter } from "./routes/social.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import cookieParser from "cookie-parser";

// Setup debug module to spit out all messages
// Do `npm start` to see the debug messages
export const codeTrace = debug("comp3028:server");

// Start the app
export const app = express();
server.setup(app);

// Register middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//cookie parser
app.use(cookieParser());
app.set("view engine", "ejs");

// Track current path for active highlighting in nav bar
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

// Register routers
app.use("/", homeRouter);
app.use("/moodTracking", moodTrackingRouter);
app.use("/events", eventRouter);
app.use("/social", socialRouter);
app.use("/auth", authRouter);
app.use("/dashboard", dashboardRouter);

// Simple test route (for debugging)
app.get("/test", (req, res) => {
  res.send("Test");
});

// ####################################### No need to modify below this line #######################################

// Error handling and server startup
server.errorHandling(app);

const modulePath = fileURLToPath(import.meta.url);
const isMainProcess = process.argv[1] === modulePath;

export let runningServer;
if (isMainProcess) {
  runningServer = app.listen(server.port, () => {
    console.log(`Example app listening on http://127.0.0.1:${server.port}`);
    debug("testing");
  });
}
