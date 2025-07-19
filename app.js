import { sincronizarProductos } from "./services/syncronify.js";
import { iniciarScheduler } from "./services/scheduler.js";

console.log(
  "\x1b[34m%s\x1b[0m",
  `╔════════════════════════════════════════════════════════╗
║      🚀.🤖 - MODULO de SHOPIFY: Sync Data - 🚀.🤖      ║
╚════════════════════════════════════════════════════════╝`
);

// Ejecutar sincronización inicial
await sincronizarProductos();

// Iniciar tarea automática cada 30 minutos
iniciarScheduler();
