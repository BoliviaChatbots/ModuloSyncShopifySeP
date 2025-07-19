import fs from "fs";
import path from "path";

let bloquesEstado = []; // Array interno

/**
 * Inicializa los bloques de estado vacíos.
 * @param {number} totalBloques - Total de bloques, por defecto 20.
 */
export const inicializarBloques = (totalBloques = 20) => {
  bloquesEstado = Array.from({ length: totalBloques }, (_, i) => ({
    bloque: i + 1,
    offset: null,
    estado: null,
    tuplas: 0,
    intentos: 0,
    inicio: null,
    fin: null,
    error: null,
  }));
};

/**
 * Actualiza el estado de un bloque específico.
 */
export const actualizarBloque = (bloqueIndex, datos) => {
  if (!bloquesEstado[bloqueIndex]) return;
  bloquesEstado[bloqueIndex] = {
    ...bloquesEstado[bloqueIndex],
    ...datos,
  };
};

/**
 * Guarda el archivo de estado en disco.
 */
export const guardarEstadoEnArchivo = async (ruta) => {
  const fullPath = path.join(ruta, "estado_carga.json");
  await fs.promises.writeFile(fullPath, JSON.stringify(bloquesEstado, null, 2));
  console.log(`📝 Estado de bloques guardado!`);
};

// Resolver __dirname en ESM
//const __filename = fileURLToPath(import.meta.url);
//const __dirname = path.dirname(__filename);

// Función para verificar si todos los bloques tienen estado "EXITO"
export const verificarTodosExitosos = async (ruta) => {
  try {
    const filePath = path.join(ruta, "estado_carga.json");
    const contenido = await fs.promises.readFile(filePath, "utf-8");
    const bloques = JSON.parse(contenido);

    const todosExito = bloques.every((b) => b.estado === "EXITO");
    return todosExito;
  } catch (error) {
    //console.error("❌ Error al leer o procesar el archivo:", error.message);
    return false;
  }
};
