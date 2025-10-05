import express from 'express';
import debug from 'debug';
import dotenv from 'dotenv';
import * as server from './config/server.js';
import { homeRouter } from './routes/home.js';
import { moodTrackingRouter } from './routes/moodTracking.js';
import { authRouter } from './routes/auth.js';
import { attachUser } from './middleware/auth.js';
// Setup debug module to spit out all messages
// Do `npn start` to see the debug messages
export const codeTrace = debug("comp3028:server");
// Start the app
dotenv.config();
export const app = express();
server.setup(app);
// Register any middleware here
//track current path for active highlighting in nav bar
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});
app.use(attachUser);
// Register routers here
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use('/', homeRouter);
app.use('/auth', authRouter);
app.use("/moodTracking",moodTrackingRouter);
// Not encouraged, but this is a simple example of how to register a route without a router.
app.get("/test", (req, res) => {
  res.send("Test");
});
// ####################################### No need to modify below this line #######################################
// Start the server
server.errorHandling(app);
export const runningServer = app.listen(server.port, () => {
  console.log(`Example app listening on port http://127.0.0.1:${server.port}`);
  debug("testing");
});
