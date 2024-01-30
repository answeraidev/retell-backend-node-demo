import { Request, Response } from "express";
import axios from "axios";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import expressWs from "express-ws";
import twilio from "twilio";
import dotenv from "dotenv";

// Load up env file which contains credentials
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_ID,
  process.env.TWILIO_AUTH_TOKEN,
);

const ipAddress = "YOUR_NGROK_ADDRESS";
const retellAddress = "https://api.re-tell.ai";
const retellWsAddress = "api.re-tell.ai";

// Todo: add hangup and call transfer

export const CreatePhoneNumber = async (areaCode: number) => {
  try {
    const localNumber = await twilioClient
      .availablePhoneNumbers("US")
      .local.list({ areaCode: areaCode, limit: 1 });
    if (!localNumber || localNumber[0] == null)
      throw "No phone numbers of this area code.";

    const phoneNumberObject = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber: localNumber[0].phoneNumber,
      voiceUrl: `${ipAddress}/twilio-voice-webhook`,
    });
    console.log("Getting phone number:", phoneNumberObject);
    return phoneNumberObject;
  } catch (err) {
    console.error("Create phone number API: ", err);
  }
};

export const DeletePhoneNumber = async (phoneNumberKey: string) => {
  await twilioClient.incomingPhoneNumbers(phoneNumberKey).remove();
};

export const CreatePhoneCall = async (fromNumber: string, toNumber: string) => {
  let call: any;
  try {
    let response = await axios({
      url: `${retellAddress}/register-call`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        "Content-type": "application/json",
      },
      data: {
        agent_id: process.env.RETELL_AGENT_ID,
        audio_websocket_protocol: "twilio",
        audio_encoding: "mulaw",
        sample_rate: 8000,
      },
    });
    call = response.data;
    await twilioClient.calls.create({
      url: `${ipAddress}/twilio-voice-webhook?callId=${call.call_id}`,
      to: toNumber,
      from: fromNumber,
    });
    console.log(`Call from: ${fromNumber} to: ${toNumber}`);
  } catch (error: any) {
    console.error("failer to retrieve caller information: ", error);
  }
};

export const RegisterTwilioApi = (app: expressWs.Application) => {
  // Twilio voice webhook
  app.post("/twilio-voice-webhook", async (req: Request, res: Response) => {
    let callId = "";
    try {
      let res2 = await axios({
        url: `${retellAddress}/register-call`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
          "Content-type": "application/json",
        },
        data: {
          agent_id: process.env.RETELL_AGENT_ID,
          audio_websocket_protocol: "twilio",
          audio_encoding: "mulaw",
          sample_rate: 8000,
        },
      });
      callId = res2.data.call_id;

      // Start phone call websocket
      const response = new VoiceResponse();
      const start = response.connect();
      const stream = start.stream({
        url: `wss://${retellWsAddress}/audio-websocket/${callId}`,
      });
      res.set("Content-Type", "text/xml");
      res.send(response.toString());
    } catch (err) {
      console.error("Error in twilio voice webhook:", err);
      res.status(500).send();
    }
  });
};
