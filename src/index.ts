import { Server } from "./server";
import { RegisterTwilioApi } from "./twilio_api";
import dotenv from "dotenv";

// Load up env file which contains credentials
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

const server = new Server();

// RegisterTwilioApi(server.app);

server.listen(8080);
