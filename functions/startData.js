import { ejecutarCarga } from "./fetchData.js";
import { queryMaster } from "../services/db.js";

const salida = "./data";

export const iniciarCargaMasterLocal = async () => {
  console.log(`🛠️  Proceso "Traer Libros de SeP": START`);
  let totalIntentos = 0;
  let bloquesFallidos = [];
  const maxIteraciones = 2;
  let totalTuplas = 0;

  do {
    console.log(`🔁 Iteración #${totalIntentos + 1} de carga...`);

    const resumen = await ejecutarCarga(
      queryMaster,
      salida,
      1000,
      18,
      bloquesFallidos.length > 0 ? bloquesFallidos : null
    );

    bloquesFallidos = resumen.bloquesErrorIndex;
    totalTuplas += resumen.totalTuplas;
    totalIntentos++;

    // console.log("\n📋 Resumen:");
    // console.log(`Total de tuplas en esta iteración: ${resumen.totalTuplas}`);
    // console.log(`Bloques exitosos: ${resumen.bloquesExitosos}`);
    // console.log(`Bloques fallidos: ${resumen.bloquesFallidos}`);

    if (bloquesFallidos.length > 0) {
      console.warn(
        `⚠️  Se volverá a intentar con ${bloquesFallidos.length} bloques fallidos...`
      );
    }
  } while (bloquesFallidos.length > 0 && totalIntentos < maxIteraciones);

  const estadoFinal = {
    status: bloquesFallidos.length === 0,
    totalTuplas,
    bloquesFallidos,
  };

  if (estadoFinal.status) {
    console.log(
      `🎉 Éxito total. Se importaron [`,
      estadoFinal.totalTuplas,
      `] registros.\n✅ Todos los bloques fueron procesados correctamente.`
    );
  } else {
    console.log(
      `❌ Carga incompleta. Se recuperaron ${estadoFinal.totalTuplas} registros.`
    );
    console.log(
      "\n🚨 Algunos bloques no pudieron ser procesados después de múltiples intentos."
    );
    // console.error(
    //   `Bloques fallidos finales: ${bloquesFallidos
    //     .map((b) => b + 1)
    //     .join(", ")}`
    // );
  }
  console.log(`🛠️  Proceso "Traer Libros de SeP": END`);
  return estadoFinal;
};

const main = async () => {
  const resultado = await iniciarCargaMasterLocal();

  if (resultado.status) {
    console.log(
      `🎉 Éxito total. Se cargaron ${resultado.totalTuplas} registros.`
    );
  } else {
    console.log(
      `❌ Carga incompleta. Se recuperaron ${resultado.totalTuplas} registros.`
    );
  }
};

//main();
