import express, { Request } from "express";
import { RawData, WebSocket } from "ws";
import { createServer, Server as HTTPServer } from "http";
import cors from "cors";
import expressWs from "express-ws";
import { DemoLlmClient, RetellRequest } from "./llm_azure_openai";
import { RegisterTwilioApi } from "./twilio_api";

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

    // RegisterTwilioApi(this.app);
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

        // Start sending the begin message to signal the client is ready.
        this.llmClient.BeginMessage(ws);

        ws.on("error", (err) => {
          console.error("Error received in LLM websocket client: ", err);
        });

        ws.on("message", async (data: RawData, isBinary: boolean) => {
          if (isBinary) {
            console.error("Got binary message instead of text in websocket.");
            ws.close(1002, "Cannot find corresponding Retell LLM.");
          }
          try {
            const request: RetellRequest = JSON.parse(data.toString());
            this.llmClient.DraftResponse(request, ws);
          } catch (err) {
            console.error("Error in parsing LLM websocket message: ", err);
            ws.close(1002, "Cannot parse incoming message.");
          }
        });
      },
    );
  }
}
