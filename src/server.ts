import express, { Request, Response } from "express";
import { RawData, WebSocket } from "ws";
import { createServer, Server as HTTPServer } from "http";
import cors from "cors";
import expressWs from "express-ws";
import { DemoLlmClient, RetellRequest } from "./llm_azure_openai";
import { RegisterTwilioApi } from "./twilio_api";
import axios from "axios";

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
    this.handleRegisterCallAPI();
    this.llmClient = new DemoLlmClient();

    // RegisterTwilioApi(this.app);
  }

  listen(port: number): void {
    this.app.listen(port);
    console.log("Listening on " + port);
  }



  handleRegisterCallAPI() {
    this.app.post("/register-call-on-your-server", async (req: Request, res: Response) => {
      // Extract agentId from request body; apiKey should be securely stored and not passed from the client
      const { agentId } = req.body;

      try {
        const response = await this.retellRegisterCallAPI(agentId);
        // Send back the successful response to the client
        res.json(response);
      } catch (error) {
        console.error("Error registering call:", error);
        // Send an error response back to the client
        res.status(500).json({ error: "Failed to register call" });
      }
    });
  }

  async retellRegisterCallAPI(agentId: string) {
    const apiUrl = "https://api.re-tell.ai/register-call";

    const response = await axios({
      url: apiUrl,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        agent_id: agentId,
        audio_websocket_protocol: "web",
        audio_encoding: "s16le",
        sample_rate: 44100,
      },
    });

    return response.data;
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
