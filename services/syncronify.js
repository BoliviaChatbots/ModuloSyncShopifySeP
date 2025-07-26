// services/sync.service.js
import {
  obtenerProductos,
  obtenerAllProductos,
  compararProductos,
  subirProductos,
  obtenerAllColecciones,
} from "../controllers/productos.controller.js";
import fs from "fs";
import path from "path";
import { getConnection, rootDir, respaldarArchivo } from "../services/db.js";
import { iniciarCargaMasterLocal } from "../functions/startData.js";

const outputDir = path.join(rootDir, "data");
const ruta = path.join(outputDir, "booksync.json");

export const sincronizarProductos = async () => {
  console.log("🔍 Sincronizando productos...");
  respaldarArchivo(ruta);
  await getConnection();
  const resultado = await iniciarCargaMasterLocal();

  // Paso 1: Obtener productos de SQL Server
  const productosDB = await obtenerProductos();

  // Paso 2: Obtener productos de Shopify
  const collects = await obtenerAllColecciones();
  const productosShopify = await obtenerAllProductos();

  // Paso 3: Comparar y crear nuevo array de productos NEWS-UPDATE
  const relaciones = await compararProductos();

  // Paso 4: Comparar y crear nuevos productos
  const productosActualizados = await subirProductos();

  await getConnection();

  // Paso 5: Guardar relaciones actualizadas
  //await guardarJSON(relacionPath, nuevasRelaciones);
};
