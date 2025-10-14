/**
 * Main entry point - simple bootstrap for the game.
 * All game logic is encapsulated in the Game class.
 */
import { Game } from "./Game";
import { Logger } from "./utils/logger";
import { loadConfig } from "./config/gameConfig";

const logger = Logger.create("Main");

async function main() {
  try {
    // Get canvas element
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    if (!canvas) {
      throw new Error("Canvas element 'renderCanvas' not found");
    }

    logger.info("Initializing game...");

    // Load configuration
    const config = await loadConfig();
    logger.info("Configuration loaded", { config });

    // Create and initialize game
    const game = new Game(canvas, config);

    await game.init();
    game.start();

    // Expose for debugging
    (window as any).game = game;
    (window as any).scene = game.getScene();

    logger.info("Game started successfully");
  } catch (error) {
    logger.error("Failed to start game", { error });
    alert(`Failed to start game: ${error}`);
  }
}

// Start the game
main();
