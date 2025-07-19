import fs from "fs";
import path from "path";
import {
  getConnection,
  mostrarLoading,
  resetearLoading,
} from "../services/db.js";
import {
  inicializarBloques,
  actualizarBloque,
  guardarEstadoEnArchivo,
} from "./bloqueManager.js";

/**
 * Ejecuta carga por bloques, con reintento individual y soporte para reintento global.
 * @param {string} baseQuery - Query principal (sin ORDER ni OFFSET).
 * @param {string} outputDir - Ruta de salida.
 * @param {number} pageSize - Tamaño de página.
 * @param {number} maxBloques - Total de bloques (solo en primera ejecución).
 * @param {number[]} bloquesPersonalizados - Índices de bloques a reintentar (0-based).
 */
export const ejecutarCarga = async (
  baseQuery,
  outputDir,
  pageSize = 1000,
  maxBloques = 20,
  bloquesPersonalizados = null
) => {
  const pool = await getConnection();
  const bufferDatos = [];
  const errores = [];

  const bloques =
    bloquesPersonalizados ?? Array.from({ length: maxBloques }, (_, i) => i);
  if (!bloquesPersonalizados) {
    inicializarBloques(maxBloques);
  }

  for (const bloqueIndex of bloques) {
    const bloque = bloqueIndex + 1;
    const offset = bloqueIndex * pageSize;
    let intentos = 0;
    let exito = false;
    let datos = [];
    const tiempoInicio = new Date();
    mostrarLoading();

    while (intentos < 3 && !exito) {
      intentos++;
      try {
        const queryPaginado = `
          ${baseQuery}
          
          OFFSET ${offset} ROWS
          FETCH NEXT ${pageSize} ROWS ONLY;
        `;

        // console.log(
        //   `📦 Ejecutando bloque ${bloque} (offset: ${offset}) | Intento ${intentos}`
        // );
        const resultado = await pool.request().query(queryPaginado);
        datos = resultado.recordset;
        exito = true;
      } catch (err) {
        console.warn(
          `⚠️  Error en bloque ${bloque}, intento ${intentos}: ${err.message}`
        );
        if (intentos === 3) {
          errores.push({ bloqueIndex, bloque, offset, error: err.message });
        } else {
          await new Promise((res) => setTimeout(res, 1000));
        }
      }
    }

    const tiempoFin = new Date();

    actualizarBloque(bloqueIndex, {
      offset,
      estado: exito ? "EXITO" : "FALLIDO",
      tuplas: datos.length,
      intentos,
      inicio: tiempoInicio.toISOString(),
      fin: tiempoFin.toISOString(),
      error: exito
        ? null
        : errores.find((e) => e.bloqueIndex === bloqueIndex)?.error ||
          "Error desconocido",
    });

    if (exito && datos.length > 0) {
      bufferDatos.push(...datos);
    }

    if (!exito) {
      console.log(`❌ Bloque ${bloque} falló después de 3 intentos.`);
    } else {
      // console.log(
      //   `✅ Bloque ${bloque} cargado correctamente con ${datos.length} filas.`
      // );
    }
  }

  resetearLoading();

  await fs.promises.mkdir(outputDir, { recursive: true });

  const fechaHora = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .slice(0, 15);
  // Pasos para Guardar los LIBROS importados... SIN interesar si HAY ERRORES
  // const salidaDatos = path.join(outputDir, `masterLocal.json`);
  // await fs.promises.writeFile(
  //   salidaDatos,
  //   JSON.stringify(bufferDatos, null, 2)
  // );

  await guardarEstadoEnArchivo(outputDir);

  if (errores.length > 0) {
    const salidaErrores = path.join(
      outputDir,
      `/Errores/errores_${fechaHora}.json`
    );
    await fs.promises.writeFile(
      salidaErrores,
      JSON.stringify(errores, null, 2)
    );
    console.warn(`⚠️  Errores guardados en: ${salidaErrores}`);
  } else {
    // 🚨🚨 SOLO guarda si NO hay ERRORES 🚨🚨
    const salidaDatos = path.join(outputDir, `masterLocal.json`);
    await fs.promises.writeFile(
      salidaDatos,
      JSON.stringify(bufferDatos, null, 2)
    );
    // console.log(`📁 Datos finales guardados en: ${salidaDatos}`);
    // console.log(`📊 Total de elementos recuperados: ${bufferDatos.length}`);
  }

  return {
    totalTuplas: bufferDatos.length,
    bloquesExitosos: bloques.length - errores.length,
    bloquesFallidos: errores.length,
    bloquesErrorIndex: errores.map((e) => e.bloqueIndex),
  };
};
