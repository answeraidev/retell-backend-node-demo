import { RegisterTwilioApi } from "./twilio_api";
import express from "express";
import expressWs from "express-ws";

const app = expressWs(express()).app;

RegisterTwilioApi(app);

app.listen(3003);
console.log("Listening on 3003");
