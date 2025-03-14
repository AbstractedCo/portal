import { createServer } from "vite";
import { createServer as createNetServer } from "net";

async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createNetServer()
      .once("error", () => {
        resolve(true);
      })
      .once("listening", () => {
        server.close();
        resolve(false);
      })
      .listen(port);
  });
}

async function startDebugServer() {
  try {
    const port = 5174;
    
    // Check if port is already in use
    if (await isPortInUse(port)) {
      console.log(`\nDebug server already running at: http://localhost:${port}`);
      console.log(
        "Debug account:",
        "i528vYpnzXfjLTHCiS8paegpef11UkC33tqx3f4sJt7D57yVT",
      );
      process.exit(0);
    }

    // Create Vite server with debug environment variables
    const server = await createServer({
      configFile: "./vite.config.ts",
      mode: "development",
      server: {
        port,
      },
      envPrefix: "VITE_",
      define: {
        "import.meta.env.VITE_DEBUG_MODE": JSON.stringify("true"),
        "import.meta.env.VITE_DEBUG_ACCOUNT": JSON.stringify(
          "i528vYpnzXfjLTHCiS8paegpef11UkC33tqx3f4sJt7D57yVT",
        ),
      },
    });

    await server.listen();

    const resolvedUrl =
      server.resolvedUrls?.local[0] || `http://localhost:${port}`;
    console.log("\nDebug server running at:", resolvedUrl);
    console.log(
      "Debug account:",
      "i528vYpnzXfjLTHCiS8paegpef11UkC33tqx3f4sJt7D57yVT",
    );
  } catch (error) {
    console.error("Failed to start debug server:", error);
    process.exit(1);
  }
}

// Start the server
startDebugServer().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
