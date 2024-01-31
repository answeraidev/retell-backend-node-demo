import dotenv from "dotenv";
// Load up env file which contains credentials
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

import { Server } from "./server";

const server = new Server();

// RegisterTwilioApi(server.app);

server.listen(8080);
