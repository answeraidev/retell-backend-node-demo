import { Request, Response } from "express";
import axios from "axios";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import expressWs from "express-ws";
import twilio from "twilio";
import { RetellClient } from "retell-sdk";
import {
  AudioWebsocketProtocol,
  AudioEncoding,
} from "retell-sdk/models/components";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_ID,
  process.env.TWILIO_AUTH_TOKEN,
);

const retellClient = new RetellClient({
  apiKey: process.env.RETELL_API_KEY,
});

const ipAddress = process.env.NGROK_IP_ADDRESS;

// Todo: add hangup and call transfer

// create a new phone number and route it to use this server.
export const CreatePhoneNumber = async (areaCode: number, agentId: string) => {
  try {
    const localNumber = await twilioClient
      .availablePhoneNumbers("US")
      .local.list({ areaCode: areaCode, limit: 1 });
    if (!localNumber || localNumber[0] == null)
      throw "No phone numbers of this area code.";

    const phoneNumberObject = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber: localNumber[0].phoneNumber,
      voiceUrl: `${ipAddress}/twilio-voice-webhook/${agentId}`,
    });
    console.log("Getting phone number:", phoneNumberObject);
    return phoneNumberObject;
  } catch (err) {
    console.error("Create phone number API: ", err);
  }
};

export const RegisterPhoneNumber = async (number: string, agentId: string) => {
  try {
    const phoneNumbers = await twilioClient.incomingPhoneNumbers.list();
    let numberSid;
    for (const phoneNumber of phoneNumbers) {
      if (phoneNumber.phoneNumber === number) {
        numberSid = phoneNumber.sid;
      }
    }
    if (numberSid == null) {
      return console.error(
        "Unable to locate this number in your Twilio account, is the number you used in BCP 47 format?",
      );
    }

    await twilioClient.incomingPhoneNumbers(numberSid).update({
      voiceUrl: `${ipAddress}/twilio-voice-webhook/${agentId}`,
    });
  } catch (error: any) {
    console.error("failer to retrieve caller information: ", error);
  }
};

export const DeletePhoneNumber = async (phoneNumberKey: string) => {
  await twilioClient.incomingPhoneNumbers(phoneNumberKey).remove();
};

export const CreatePhoneCall = async (
  fromNumber: string,
  toNumber: string,
  agentId: string,
) => {
  try {
    await twilioClient.calls.create({
      url: `${ipAddress}/twilio-voice-webhook/${agentId}`,
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
  app.post(
    "/twilio-voice-webhook/:agent_id",
    async (req: Request, res: Response) => {
      const agentId = req.params.agent_id;
      try {
        const callResponse = await retellClient.registerCall({
          agentId: agentId,
          audioWebsocketProtocol: AudioWebsocketProtocol.Twilio,
          audioEncoding: AudioEncoding.Mulaw,
          sampleRate: 8000,
        });
        if (callResponse.callDetail) {
          // Start phone call websocket
          const response = new VoiceResponse();
          const start = response.connect();
          const stream = start.stream({
            url: `wss://api.re-tell.ai/audio-websocket/${callResponse.callDetail.callId}`,
          });
          res.set("Content-Type", "text/xml");
          res.send(response.toString());
        }
      } catch (err) {
        console.error("Error in twilio voice webhook:", err);
        res.status(500).send();
      }
    },
  );
};
