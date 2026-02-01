import { registerConnector } from "../sync/connector.registry";
import { spotifyConnectorHandler } from "./spotify.handler";

/**
 * Register the Spotify connector handler.
 * Call this during application startup.
 */
export function registerSpotifyConnector(): void {
  registerConnector(spotifyConnectorHandler);
}

// Re-export for direct access if needed
export { spotifyConnectorHandler } from "./spotify.handler";
