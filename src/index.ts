import { Server } from "./server";
import { RegisterTwilioApi } from "./twilio_api";

const server = new Server();

RegisterTwilioApi(server.app);

server.listen(8080);
