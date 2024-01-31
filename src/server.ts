import express, { Request, Response } from "express";
import { RawData, WebSocket } from "ws";
import { createServer, Server as HTTPServer } from "http";
import cors from "cors";
import expressWs from "express-ws";
import { DemoLlmClient } from "./llm";
import { RegisterTwilioApi } from "./twilio_api";
import { Readable } from "stream";

export class Server {
  private httpServer: HTTPServer;
  public app: expressWs.Application;
  private llmClient: DemoLlmClient;

  constructor() {
    this.app = expressWs(express()).app;
    this.httpServer = createServer(this.app);
    this.app.use(express.json());
    this.app.use(cors());
    this.app.use(express.urlencoded({ extended: true }));

    this.handleRetellLlmWebSocket();
    this.llmClient = new DemoLlmClient();

    RegisterTwilioApi(this.app);
  }

  listen(port: number): void {
    this.app.listen(port);
    console.log("Listening on " + port);
  }

  handleRetellLlmWebSocket() {
    this.app.ws(
      "/llm-websocket/:call_id",
      async (ws: WebSocket, req: Request) => {
        const callId = req.params.call_id;
        console.log("Handle llm ws for: ", callId);

        let responseId = 0;

        const sendStream = async (
          responseStream: Readable,
          responseStreamId: number,
        ) => {
          for await (const responseText of responseStream) {
            if (responseId !== responseStreamId) {
              // New response needed, abondon this one
              return;
            }
            const event = {
              response_id: responseId,
              content: responseText,
              content_complete: false,
              end_call: false,
            };
            ws.send(JSON.stringify(event));
          }
          // Signal end of response.
          const event = {
            response_id: responseId,
            content: "",
            content_complete: true,
            end_call: false,
          };
          ws.send(JSON.stringify(event));
        };

        ws.on("error", (err) => {
          console.error("Error received in LLM websocket client: ", err);
        });

        ws.on("message", async (data: RawData, isBinary: boolean) => {
          if (isBinary) {
            console.error(
              "Got binary message when expecting text message in LLM websocket.",
            );
            ws.close(1002, "Cannot find corresponding Retell LLM.");
          }
          try {
            const response = JSON.parse(data.toString());
            if (response.interaction_type === "update_only") {
              // process live transcript update if needed
              return;
            } else {
              responseId = response.response_id;
              const responseStream = this.llmClient.DraftResponse(
                response.transcript,
                response.interaction_type,
              );
              sendStream(responseStream, response.response_id);
            }
          } catch (err) {
            console.error("Error in parsing LLM websocket message: ", err);
            ws.close(1002, "Cannot parse incoming message.");
          }
        });

        // Start sending the begin message to signal the client is ready.
        const responseStream = this.llmClient.DraftResponse(
          [],
          "response_required",
        );
        sendStream(responseStream, responseId);
      },
    );
  }
}
