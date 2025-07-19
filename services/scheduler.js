import cron from "node-cron";
import { sincronizarProductos } from "../services/syncronify.js";

export const iniciarScheduler = () => {
  cron.schedule("*/30 * * * *", async () => {
    console.log(
      "\x1b[32m%s\x1b[0m",
      `╔════════════════════════════════════════════════════════╗
║      🚀.🤖 - MODULO de SHOPIFY: Sync Data - 🚀.🤖      ║
╚════════════════════════════════════════════════════════╝`
    );
    //console.log("🕒 Ejecutando sincronización automática..."); \x1b[32m%s\x1b[0m
    await sincronizarProductos();
  });
};
