import { useEffect, useState } from "react";

type ConnectionState = "loading" | "connected" | "error";

export default function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("loading");

  useEffect(() => {
    async function checkBackend() {
      try {
        const response = await fetch("/api/health");
        const body: unknown = await response.json();

        if (!response.ok || JSON.stringify(body) !== JSON.stringify({ status: "ok" })) {
          throw new Error("The backend returned an unexpected response.");
        }

        setConnectionState("connected");
      } catch (error) {
        console.error(error);
        setConnectionState("error");
      }
    }

    void checkBackend();
  }, []);

  return (
    <main>
      <h1>CampusLoop</h1>
      {connectionState === "loading" && <p>Connecting to the backend…</p>}
      {connectionState === "connected" && <p>Backend connected</p>}
      {connectionState === "error" && (
        <p role="alert">Unable to connect to the backend. Please make sure it is running and try again.</p>
      )}
    </main>
  );
}
