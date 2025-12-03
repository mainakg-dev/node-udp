// udp-server.ts
import dgram, { RemoteInfo } from "dgram";

interface JoystickData {
  left: {
    x: string;
    y: string;
    angle: string;
    distance: string;
  };
  right: {
    x: string;
    y: string;
    angle: string;
    distance: string;
  };
}

class UDPServer {
  private server: dgram.Socket;
  private port: number;
  private clients: Map<string, number>;

  constructor(port: number = 8080) {
    this.port = port;
    this.server = dgram.createSocket("udp4");
    this.clients = new Map();
    this.setupServer();
  }

  private setupServer(): void {
    this.server.on("error", (err: Error) => {
      console.error(`❌ Server error:\n${err.stack}`);
      this.server.close();
    });

    this.server.on("message", (msg: Buffer, rinfo: RemoteInfo) => {
      const clientId = `${rinfo.address}:${rinfo.port}`;
      this.clients.set(clientId, Date.now());

      try {
        const message = msg.toString();

        // Try to parse as JSON (joystick data)
        try {
          const data: JoystickData = JSON.parse(message);
          this.handleJoystickData(data, rinfo);
        } catch {
          // Not JSON, handle as plain text message
          this.handleTextMessage(message, rinfo);
        }
      } catch (err) {
        console.error("Error processing message:", err);
      }
    });

    this.server.on("listening", () => {
      const address = this.server.address();
      console.log("\n🚀 UDP Server Started");
      console.log("=".repeat(50));
      console.log(`📡 Listening on: ${address.address}:${address.port}`);
      console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
      console.log("=".repeat(50));
      console.log("\n💡 Waiting for messages...\n");
    });

    this.server.bind(this.port);

    // Cleanup inactive clients every 30 seconds
    setInterval(() => this.cleanupClients(), 30000);
  }

  private handleJoystickData(data: JoystickData, rinfo: RemoteInfo): void {
    const timestamp = new Date().toLocaleTimeString();
    const leftDistance = parseFloat(data.left.distance);
    const rightDistance = parseFloat(data.right.distance);

    // Only log if joysticks are being moved
    if (leftDistance > 0.1 || rightDistance > 0.1) {
      console.log(`\n🕹️  JOYSTICK DATA [${timestamp}]`);
      console.log(`📍 From: ${rinfo.address}:${rinfo.port}`);
      console.log("─".repeat(50));

      if (leftDistance > 0.1) {
        console.log("🔵 LEFT JOYSTICK (Movement):");
        console.log(
          `   X: ${data.left.x.padStart(6)} | Y: ${data.left.y.padStart(6)}`
        );
        console.log(
          `   Angle: ${data.left.angle.padStart(6)}° | Distance: ${
            data.left.distance
          }`
        );
      }

      if (rightDistance > 0.1) {
        console.log("🟢 RIGHT JOYSTICK (Camera):");
        console.log(
          `   X: ${data.right.x.padStart(6)} | Y: ${data.right.y.padStart(6)}`
        );
        console.log(
          `   Angle: ${data.right.angle.padStart(6)}° | Distance: ${
            data.right.distance
          }`
        );
      }

      // Send acknowledgment back to client
      const ack = JSON.stringify({
        status: "received",
        timestamp: Date.now(),
      });
      this.sendResponse(ack, rinfo);
    }
  }

  private handleTextMessage(message: string, rinfo: RemoteInfo): void {
    const timestamp = new Date().toLocaleTimeString();

    console.log(`\n💬 TEXT MESSAGE [${timestamp}]`);
    console.log(`📍 From: ${rinfo.address}:${rinfo.port}`);
    console.log(`📝 Message: "${message}"`);
    console.log("─".repeat(50));

    // Echo the message back
    const response = `Server received: "${message}" at ${timestamp}`;
    this.sendResponse(response, rinfo);
  }

  private sendResponse(message: string, rinfo: RemoteInfo): void {
    const buffer = Buffer.from(message);
    this.server.send(
      buffer,
      0,
      buffer.length,
      rinfo.port,
      rinfo.address,
      (err) => {
        if (err) {
          console.error(`❌ Error sending response: ${err.message}`);
        }
      }
    );
  }

  private cleanupClients(): void {
    const now = Date.now();
    const timeout = 60000; // 60 seconds

    for (const [clientId, lastSeen] of this.clients.entries()) {
      if (now - lastSeen > timeout) {
        console.log(`🔌 Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      }
    }
  }

  public getStats(): void {
    console.log("\n📊 SERVER STATISTICS");
    console.log("=".repeat(50));
    console.log(`Active Clients: ${this.clients.size}`);
    console.log(`Port: ${this.port}`);
    console.log(`Uptime: ${process.uptime().toFixed(0)}s`);
    console.log("=".repeat(50));

    if (this.clients.size > 0) {
      console.log("\n👥 Connected Clients:");
      for (const [clientId, lastSeen] of this.clients.entries()) {
        const secondsAgo = Math.floor((Date.now() - lastSeen) / 1000);
        console.log(`   ${clientId} - Last seen: ${secondsAgo}s ago`);
      }
    }
    console.log("");
  }

  public close(): void {
    console.log("\n👋 Shutting down server...");
    this.server.close(() => {
      console.log("✅ Server closed successfully");
      process.exit(0);
    });
  }
}

// Start the server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const server = new UDPServer(PORT);

// Handle graceful shutdown
process.on("SIGINT", () => {
  server.close();
});

process.on("SIGTERM", () => {
  server.close();
});

// Show stats every 60 seconds
setInterval(() => {
  server.getStats();
}, 60000);

export default UDPServer;
