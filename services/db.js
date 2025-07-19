import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Subimos un nivel a la raíz del proyecto
export const rootDir = path.resolve(__dirname, "..");

export const queryMaster = `
SELECT dbo.Items.CodigoItem as id, MAX(dbo.Items.NombreItem) as nombre, 
MAX(dbo.Items.ResumenLibro) as descripcion, MAX(dbo.Items.ISBN) as sku, 
MAX(dbo.CategoriaSubCategoria.SubCategoria) as categoria, MAX(dbo.Categoria.Categoria) as categoriamain, 
SUM(dbo.Stock.TotalIngresos - dbo.Stock.TotalSalidas) as stock, 
MAX(dbo.Stock.PrecioStockVentaLocUSD * d.CotizacionOficial) as precio,
MAX(dbo.Editoriales.Editorial) as editorial, CONCAT('https://saberespoder.com.bo/shopify/fotos/',dbo.Items.CodigoItem, '.jpg') AS imagen_url

FROM (SELECT TOP 1 CotizacionOficial FROM Cotizacion WHERE CodigoMoneda = 2 ORDER BY FechaCotizacion DESC) AS d,
dbo.CategoriaSubCategoria 
INNER JOIN dbo.Categoria ON dbo.CategoriaSubCategoria.CodigoCategoria = dbo.Categoria.CodigoCategoria 
INNER JOIN dbo.ItemCategoria ON dbo.CategoriaSubCategoria.CodigoCategoria = dbo.ItemCategoria.CodigoCategoria AND dbo.CategoriaSubCategoria.CodigoSubCategoria = dbo.ItemCategoria.CodigoSubCategoria

INNER JOIN dbo.Items ON dbo.ItemCategoria.CodigoItem = dbo.Items.CodigoItem
INNER JOIN dbo.ItemsFotografias ON dbo.Items.CodigoItem = dbo.ItemsFotografias.CodigoItem
INNER JOIN dbo.Editoriales ON dbo.Items.CodigoEditorial = dbo.Editoriales.CodigoEditorial
INNER JOIN dbo.Stock ON dbo.Items.CodigoItem = dbo.Stock.CodigoItem
INNER JOIN dbo.Almacen ON dbo.Stock.CodigoAlmacen = dbo.Almacen.CodigoAlmacen
WHERE (dbo.ItemsFotografias.IDFoto = 2)
    AND (dbo.Almacen.CodigoAlmacen > 0)
    --AND ((dbo.Stock.TotalIngresos - dbo.Stock.TotalSalidas) > -1)
    AND (dbo.Stock.PrecioStockVentaLocUSD > 0)
    AND (dbo.ItemCategoria.SecueSubCategoria = 1)
    --AND (dbo.Items.CodigoItem BETWEEN 13001 AND 15000)

GROUP BY dbo.Items.CodigoItem
ORDER BY dbo.Items.CodigoItem ASC

--OFFSET 0 ROWS FETCH NEXT 500 ROWS ONLY
`;

const dbSettings = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// Funcion VISUAL loading...
let contador = 0;
const salto = 12; // Salto de Linea Cada 12 CICLOS
export const mostrarLoading = () => {
  contador++;
  // Color por grupo de 10
  const colores = ["\x1b[35m", "\x1b[33m", "\x1b[32m", "\x1b[36m", "\x1b[34m"]; // magenta, amarillo, verde, cian, azul,
  const color = colores[Math.floor((contador - 1) / salto) % colores.length];
  const marcador = `${color}*${contador.toString().padStart(2, "0")}\x1b[0m`;
  process.stdout.write(marcador + " ");

  // Salto de línea cada 10 marcas
  if (contador % salto === 0) {
    process.stdout.write("\n");
  }
};
export const resetearLoading = () => {
  contador = 0;
};

export const getConnection = async () => {
  try {
    console.log("⏳ Conectando a la base de datos...");
    const pool = await sql.connect(dbSettings);
    const result = await pool
      .request()
      .query("SELECT GETDATE() AS fecha_actual");
    console.log(
      "✅ Conectado Correcto!  🖥️ ",
      result.recordset[0].fecha_actual
    );
    //console.log(result.recordset);
    //await sql.close();

    //const poolMain = await sql.connect(dbSettings);
    return pool;
  } catch (error) {
    console.log("❌ Error al conectar a la BD:", error.message);
    //throw error;
  }
};

export function respaldarArchivo(archivoPath) {
  if (!fs.existsSync(archivoPath)) {
    console.log(`💀 ❌  No se encontró el archivo! : ${archivoPath}`);
    return;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // los meses van de 0 a 11
  const day = String(now.getDate()).padStart(2, "0");

  const fecha = `${year}.${month}.${day}`; // Resultado: YYYY.MM.DD
  const hora = now.toTimeString().split(" ")[0].replace(/:/g, "."); // HHMMSS

  const dir = path.dirname(archivoPath);
  const base = path.basename(archivoPath); // ej: bookslocal.json
  const backupName = `F${fecha}-H${hora}.${base}`;
  const rutabackupName = path.join(dir, "Respaldos");
  //const backupName = `WinBackup.${fecha}.${hora}.${base}`;
  const backupPath = path.join(rutabackupName, backupName);
  if (!fs.existsSync(rutabackupName)) {
    fs.mkdirSync(rutabackupName);
  }
  fs.copyFileSync(archivoPath, backupPath);
  console.log(`📦 Archivo guardado (R) : ${backupName}`);
}

//getConnection();
