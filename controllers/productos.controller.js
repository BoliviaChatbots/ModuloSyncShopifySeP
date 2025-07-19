import fs from "fs";
import path from "path";
import { respaldarArchivo, rootDir, getConnection } from "../services/db.js";
import {
  subirProductoAShopify,
  updateVariants,
  updateStock,
  eliminarProductoDeShopify,
  eliminarTodosLosProductos,
  actualizarProductoEnShopify,
  obtenerTodosLosProductosShopify,
  obtenerLasColeccionesShopify,
  buscarCollectsId,
  agregarCollectsAlProducto,
} from "../services/shopify.service.js";
import { readFile, writeFile } from "fs/promises";
import { queryMaster } from "../services/db.js";

// Ruta al archivo BASE DE DATOS
const outputDir = path.join(rootDir, "data");
const outputPathLocal = path.join(outputDir, "bookslocal.json");
const rutaCollets = path.join(outputDir, "collectshopify.json");
const ruta = path.join(outputDir, "bookshopify.json");
const rutaDuples = path.join(outputDir, "bookshopifyDuples.json");
const rutaCero = path.join(outputDir, "bookshopifyCero.json");

export const obtenerProductos = async (req, res) => {
  console.log(`🛠️  Proceso "Cargar Libros": START`);

  try {
    //PRIMERA ETAPA carga desde SQL todos los registros SIN CONTROL
    // const pool = await getConnection();
    // const result = await pool.request().query(queryMaster);
    // const libros = result.recordsets[0];

    // SEGUNDA ETAPA lee el archivo con TODOS los registros
    const filePathMaster = path.join(process.cwd(), "data", "masterLocal.json");
    // Leer y parsear el archivo JSON
    let libros = [];
    try {
      if (fs.existsSync(filePathMaster)) {
        // Asigna el array a la variable "libros"
        const contenido = fs.readFileSync(filePathMaster, "utf8");
        libros = JSON.parse(contenido);
      }
    } catch (error) {
      console.error("❌ Error al leer el archivo JSON:", error.message);
    } //END 2DA ETAPA

    // Verifica cuántos libros se cargaron
    console.log(`📚 Se cargaron [`, libros.length, `] libros.`);

    respaldarArchivo(outputPathLocal);
    //console.log(libros);
    // Creamos un array con solo los datos necesarios
    const productosFiltrados = libros.map((producto) => {
      const categoria = producto.categoria.trim().toUpperCase();
      const categoriamaster = producto.categoriamain.trim().toUpperCase();
      const collection =
        categoria != "SIN SUB CATEGORIA" ? categoria : categoriamaster;

      //console.log(collection);
      return {
        //id: producto.id,
        title: producto.nombre.trim(),
        handle: producto.id.toString().trim(),
        body_html: producto.descripcion,
        vendor: producto.editorial.trim(),
        product_type: "Libro",
        collection: collection,
        images: [{ src: `${producto.imagen_url}` }],
        variants: [
          {
            sku: producto.sku.toString().trim(),
            price: parseFloat(producto.precio) || 0,
            inventory_management: "shopify",
            inventory_quantity: producto.stock || 0,
            inventory_policy: "deny",
            fulfillment_service: "manual",
          },
        ],
      };
    });

    // Crear la carpeta si no existe
    fs.mkdirSync(outputDir, { recursive: true });
    // Guardar archivo JSON
    fs.writeFileSync(
      outputPathLocal,
      JSON.stringify(productosFiltrados, null, 2),
      "utf8"
    );
    console.log(`✅ Archivo guardado en: ${outputPathLocal}`);
    console.log(`Total de LIBROS de SeP: `, libros.length);

    //res.json({ mensaje: `Productos encontrados: ${data.length}`, data });
    console.log(`🛠️  Proceso "Cargar Libros": END`);
  } catch (err) {
    const mensajeCorto = err?.message || err.toString();
    console.log(
      `🛠️  Proceso "Cargar Libros": IMCOMPLETO\nERROR= ${mensajeCorto}`
    );
    //res.status(500).json({ error: "Error al obtener productos" });
  }
};

export const obtenerAllColecciones = async (req, res) => {
  console.log(`🛠️  Proceso Colecciones: START`);

  try {
    const resultado = await obtenerLasColeccionesShopify();
    // Crear la carpeta si no existe
    fs.mkdirSync(outputDir, { recursive: true });
    // Escribimos el archivo con las Colecciones
    fs.writeFileSync(rutaCollets, JSON.stringify(resultado, null, 2), "utf-8");
    console.log(`✅ Archivo guardado en ${rutaCollets}`);

    console.log(`🛠️  Proceso Colecciones: END`);
  } catch (err) {
    //console.error(err);
    const mensajeCorto = err?.message || err.toString();
    console.log(`🛠️  Proceso Colecciones: IMCOMPLETO\nERROR= ${mensajeCorto}`);
    //res.status(500).json({ error: "Error al obtener las colecciones" });
  }
};

export const obtenerAllProductos = async (req, res) => {
  console.log(`🛠️  Proceso "Traer Libros de Shopify": START`);

  try {
    const resultado = await obtenerTodosLosProductosShopify();
    respaldarArchivo(ruta);
    // Creamos un array con solo los datos necesarios
    const productosLimpios = resultado.map((producto) => {
      const variante = producto.variants?.[0] || {};
      return {
        id: producto.id,
        title: producto.title.trim(),
        handle: producto.handle.toString().trim(),
        vendor: producto.vendor.trim(),
        product_type: "Libro",
        variants: [
          {
            id: variante.id,
            product_id: producto.id,
            sku: variante.sku?.toString().trim() ?? "",
            price: variante.price ? parseFloat(variante.price) : 0,
            inventory_management: variante.inventory_management,
            inventory_item_id: variante.inventory_item_id,
            inventory_quantity: variante.inventory_quantity || 0,
          },
        ],
      };
    });

    // Usar un arreglo para almacenar productos únicos
    // 1. Arreglos para productos únicos y duplicados
    const productosUnicos = [];
    const productosDuplicados = [];
    const productosPrecioCero = [];

    const productosConPrecioCero = productosLimpios.filter((producto) => {
      if (producto.variants[0].price < 1) {
        productosPrecioCero.push(producto);
      }
      const primeraVariante = producto.variants[0];
      return primeraVariante && primeraVariante.price === 0;
    });

    for (const producto of productosLimpios) {
      const titulo = producto.title.trim();
      const handle = producto.handle;
      const handleBase = handle.replace(/-\d+$/, "");

      // Verificar si ya existe un producto con mismo título y handle base
      const yaExiste = productosUnicos.find(
        (p) => p.title.trim() === titulo && p.handle === handleBase
      );

      if (!yaExiste && handle === handleBase) {
        // Si no existe y es el handle base, agregar a productos únicos
        productosUnicos.push(producto);
      } else if (handle !== handleBase || yaExiste) {
        // Si es duplicado (ej: "handle-1", "handle-2" o ya existía el base)
        productosDuplicados.push({
          id: producto.id,
          title: producto.title,
          handle: producto.handle,
        });
      }
    }

    // Crear la carpeta si no existe
    fs.mkdirSync(outputDir, { recursive: true });
    // -Lista de LIBROS sin DUPLICADOS
    fs.writeFileSync(ruta, JSON.stringify(productosUnicos, null, 2), "utf-8");
    console.log(`✅ Archivo guardado en ${ruta}`);
    console.log(`Total de LIBROS de Shopify: [`, productosUnicos.length, `]`);

    //Proceso de Eliminar con Precio=0
    if (productosPrecioCero && productosPrecioCero.length > 0) {
      console.log(
        `LIBROS SIN PRECIO que se eliminaron: `,
        productosPrecioCero.length
      );
      // Escribimos el archivo PRODUCTOS con Precio=0
      fs.writeFileSync(
        rutaCero,
        JSON.stringify(productosPrecioCero, null, 2),
        "utf-8"
      );
      console.log(`✅ Duplicados guardados: ${rutaCero}`);

      //Eliminamos los SIN PRECIO 🚨🚨🚨🚨
      for (const cero of productosPrecioCero) {
        //await eliminarProductoDeShopify(cero.id);
      }
    } else {
      console.log(`✅ NO EXISTEN 👍 ✔️. Precio = `, 0);
    }

    //Proceso de Eliminar Duplicados
    if (productosDuplicados && productosDuplicados.length > 0) {
      console.log(
        `LIBROS DUPLICADOS que se eliminaron: `,
        productosDuplicados.length
      );
      // Escribimos el archivo PRODUCTOS DUPLICADOS
      fs.writeFileSync(
        rutaDuples,
        JSON.stringify(productosDuplicados, null, 2),
        "utf-8"
      );
      console.log(`✅ Duplicados guardados: ${rutaDuples}`);

      //Eliminamos los DUPLICADOS 🚨🚨🚨🚨
      for (const dup of productosDuplicados) {
        //await eliminarProductoDeShopify(dup.id);
      }
    } else {
      console.log(`✅ NO EXISTEN 👍 ✔️. Duplicados `);
    }

    //const totalResultado = resultado.length;
    // res.json({
    //   mensaje: `Productos encontrados exitosamente: ${totalResultado}`,
    //   resultado,
    // });
    console.log(`🛠️  Proceso "Traer Libros de Shopify": END`);
  } catch (err) {
    //console.error(err);
    const mensajeCorto = err?.message || err.toString();
    console.log(
      `🛠️  Proceso "Traer Libros de Shopify": IMCOMPLETO\nERROR= ${mensajeCorto}`
    );
    //res.status(500).json({ error: "Error al obtener los productos" });
  }
};

export const compararProductos = async () => {
  const localPath = path.join(outputDir, "bookslocal.json");
  const shopifyPath = path.join(outputDir, "bookshopify.json"); //Aqui master
  const outputPath = path.join(outputDir, "booksync.json");

  // console.log("📂 Leyendo archivos local.json y shopify.json...");
  console.log("📂 Leyendo archivo local.json...");
  const localData = await readFile(localPath, "utf-8");

  console.log("📂 Leyendo archivo shopify.json...");
  const shopifyData = await readFile(shopifyPath, "utf-8");

  const localArray = JSON.parse(localData);
  const shopifyArray = JSON.parse(shopifyData);

  const cambios = [];
  const igual = [];

  console.log(
    `🔍 Comparando Libros <<`,
    localArray.length,
    `>> de SeP con los <<`,
    shopifyArray.length,
    `>> de Shopify...`
  );

  for (const localProducto of localArray) {
    const handleLocal = localProducto.handle.toString();
    const skuLocal = localProducto.variants[0]?.sku;

    // Buscar el producto en Shopify por handle
    const productoShopify = shopifyArray.find(
      (p) =>
        p.handle.toString() === handleLocal &&
        p.variants?.some((v) => v.sku === skuLocal)
    );

    // Si no se encuentra, es un nuevo producto
    if (!productoShopify) {
      //console.log(`☑️  Producto nuevo detectado: ${localProducto.title}`);
      cambios.push({
        status: "NEW",
        local: localProducto,
      });
      continue;
    }

    // Buscar la variante correspondiente
    const varianteShopify = productoShopify.variants.find(
      (v) => v.sku === skuLocal
    );
    const varianteLocal = localProducto.variants[0];

    // Comparar datos clave
    const difPrecio =
      parseFloat(varianteShopify.price) !== parseFloat(varianteLocal.price);
    const difStock =
      parseInt(varianteShopify.inventory_quantity) !==
      parseInt(varianteLocal.inventory_quantity);
    const difTitulo = productoShopify.title !== localProducto.title;
    const difEditorial = productoShopify.vendor !== localProducto.vendor;

    if (difPrecio || difStock || difTitulo || difEditorial) {
      // console.log(`✏️  Producto para modificar: ${localProducto.title}`);
      // if (difPrecio)
      //   console.log(
      //     ` 💲  Precio diferente: Shopify=${varianteShopify.price}, Local=${varianteLocal.price}`
      //   );
      // if (difStock)
      //   console.log(
      //     `  📦  Stock diferente: Shopify=${varianteShopify.inventory_quantity}, Local=${varianteLocal.inventory_quantity}`
      //   );
      // if (difTitulo) console.log(`  🏷️  Título diferente`);
      // if (difEditorial) console.log(`  📖  Editorial diferente`);

      // Si lo encuantra y EXISTEN diferencias lo guarda
      cambios.push({
        status: "UPDATE",
        local: localProducto,
        shopify: productoShopify,
      });
    } else {
      // SI lo encuenta y NO EXISTEN cambios o diferencias => status OK
      cambios.push({
        status: "OK",
        local: localProducto,
        shopify: productoShopify,
      });
      igual.push({
        local: localProducto,
        shopify: productoShopify,
      });
      //console.log(`✅ Producto sin cambios.`);
    }
  }

  // Guardar resultados
  await writeFile(outputPath, JSON.stringify(cambios, null, 2), "utf-8");
  console.log(
    `✅ Comparación finalizada. Se procesaron ${cambios.length} productos.`
  );

  const nuevos = cambios.filter((item) => item.status === "NEW");
  const viejos = cambios.filter((item) => item.status === "UPDATE");
  const iguales = cambios.filter((item) => item.status === "OK");
  console.log(
    `Libros Nuevos [`,
    nuevos.length,
    `] => Libros Viejos [`,
    viejos.length,
    `] => Libros iguales [`,
    iguales.length,
    `]`
  );
  //console.log(`Libros Nuevos: [ ${nuevos.length} ]`);

  console.log(`📁 Guardado en: ${outputPath}`);
};

// export const compararProductos = async () => {
//   const localPath = path.join(outputDir, "bookslocal.json");
//   const shopifyPath = path.join(outputDir, "bookshopify.json"); //Aqui master
//   const outputPath = path.join(outputDir, "booksync.json");

//   // console.log("📂 Leyendo archivos local.json y shopify.json...");
//   console.log("📂 Leyendo archivo local.json...");
//   const localData = await readFile(localPath, "utf-8");

//   console.log("📂 Leyendo archivo shopify.json...");
//   const shopifyData = await readFile(shopifyPath, "utf-8");

//   const localArray = JSON.parse(localData);
//   const shopifyArray = JSON.parse(shopifyData);

//   const cambios = [];
//   const igual = [];

//   console.log(
//     `🔍 Comparando Libros <<`,
//     localArray.length,
//     `>> de SeP con los <<`,
//     shopifyArray.length,
//     `>> de Shopify...`
//   );

//   for (const localProducto of localArray) {
//     const handleLocal = localProducto.handle.toString();
//     const skuLocal = localProducto.variants[0]?.sku;

//     // Buscar el producto en Shopify por handle
//     const productoShopify = shopifyArray.find(
//       (p) =>
//         p.handle.toString() === handleLocal &&
//         p.variants?.some((v) => v.sku === skuLocal)
//     );

//     // Si no se encuentra, es un nuevo producto
//     if (!productoShopify) {
//       //console.log(`☑️  Producto nuevo detectado: ${localProducto.title}`);
//       cambios.push({
//         status: "NEW",
//         local: localProducto,
//       });
//       continue;
//     }

//     // Buscar la variante correspondiente
//     const varianteShopify = productoShopify.variants.find(
//       (v) => v.sku === skuLocal
//     );
//     const varianteLocal = localProducto.variants[0];

//     // Comparar datos clave
//     const difPrecio =
//       parseFloat(varianteShopify.price) !== parseFloat(varianteLocal.price);
//     const difStock =
//       parseInt(varianteShopify.inventory_quantity) !==
//       parseInt(varianteLocal.inventory_quantity);
//     const difTitulo = productoShopify.title !== localProducto.title;
//     const difEditorial = productoShopify.vendor !== localProducto.vendor;

//     if (difPrecio || difStock || difTitulo || difEditorial) {
//       // console.log(`✏️  Producto para modificar: ${localProducto.title}`);
//       // if (difPrecio)
//       //   console.log(
//       //     ` 💲  Precio diferente: Shopify=${varianteShopify.price}, Local=${varianteLocal.price}`
//       //   );
//       // if (difStock)
//       //   console.log(
//       //     `  📦  Stock diferente: Shopify=${varianteShopify.inventory_quantity}, Local=${varianteLocal.inventory_quantity}`
//       //   );
//       // if (difTitulo) console.log(`  🏷️  Título diferente`);
//       // if (difEditorial) console.log(`  📖  Editorial diferente`);

//       // Si lo encuantra y EXISTEN diferencias lo guarda
//       cambios.push({
//         status: "UPDATE",
//         local: localProducto,
//         shopify: productoShopify,
//       });
//     } else {
//       // SI lo encuenta y NO EXISTEN cambios o diferencias => status OK
//       cambios.push({
//         status: "OK",
//         local: localProducto,
//         shopify: productoShopify,
//       });
//       igual.push({
//         local: localProducto,
//         shopify: productoShopify,
//       });
//       //console.log(`✅ Producto sin cambios.`);
//     }
//   }

//   // Guardar resultados
//   await writeFile(outputPath, JSON.stringify(cambios, null, 2), "utf-8");
//   console.log(
//     `✅ Comparación finalizada. Se encontraron ${cambios.length} productos con cambios (NEW o UPDATE).`
//   );

//   const nuevos = cambios.filter((item) => item.status === "NEW");
//   const viejos = cambios.filter((item) => item.status === "UPDATE");
//   const iguales = cambios.filter((item) => item.status === "OK");
//   console.log(
//     `Libros Nuevos [`,
//     nuevos.length,
//     `] => Libros Viejos [`,
//     viejos.length,
//     `] => Libros iguales [`,
//     iguales.length,
//     `]`
//   );
//   //console.log(`Libros Nuevos: [ ${nuevos.length} ]`);

//   console.log(`📁 Guardado en: ${outputPath}`);
// };

export const subirProductos = async (req, res) => {
  try {
    const outputPath = path.join(outputDir, "booksync.json");
    console.log("📂 Leyendo archivo de DATOS SINCRONIZADOS");
    console.log(`🛠️  Proceso "Sync ON LINE de Shopify": START`);
    const syncData = await readFile(outputPath, "utf-8");
    const datos = JSON.parse(syncData);
    // 1. Filtramos solo los productos con status "NEW"
    const nuevos = datos.filter((item) => item.status === "NEW");
    // 2. Creamos el nuevo array con los productos nuevos
    const productos = nuevos.map((item) => {
      const local = item.local;
      //console.log(local);
      const variant = local.variants[0];
      const imagen =
        local.images && local.images.length > 0 ? local.images[0].src : null;
      return {
        title: local.title,
        body_html: local.body_html,
        handle: local.handle,
        vendor: local.vendor,
        product_type: local.product_type,
        collection: local.collection,
        images: [
          {
            src: imagen,
          },
        ],

        variants: variant,
      };
    });
    const resultados = [];
    for (const producto of productos) {
      try {
        const subida = await subirProductoAShopify(producto);
        const id = subida.product.id;
        //const update = await actualizarProductoEnShopify(id, producto);
        const variantsId = subida.product.variants[0].id;
        const updateBook = await updateVariants(variantsId, producto.variants);
        //console.log("Variants ID:", variants);
        const inventoryItemId = subida.product.variants[0].inventory_item_id;
        //console.log("Inventory Item ID:", inventoryItemId);
        const stock = producto.variants.inventory_quantity;
        //console.log("Inventory Stock: ", stock);
        const updateStockData = await updateStock(inventoryItemId, stock);

        const colectionId = await buscarCollectsId(producto.collection);
        const agregarColeccion = await agregarCollectsAlProducto(
          colectionId,
          id
        );
        //console.log("Collection Id: ", colectionId);
        resultados.push(subida);
      } catch (err) {
        console.error(err);
        const mensajeCorto = err?.message || err.toString();
        console.log(
          `🛠️  Proceso "Sync ON LINE de Shopify": IMCOMPLETO\nERROR= ${mensajeCorto}`
        );
      }
    }

    // 1. Filtramos solo los productos con status "UPDATE"
    const actualizados = datos.filter((item) => item.status === "UPDATE");
    // 2. Creamos el nuevo array con los productos nuevos
    const productosAct = actualizados.map((item) => {
      const local = item.local;
      const shopify = item.shopify;
      //console.log(local);
      const variant = local.variants[0];
      const imagen =
        local.images && local.images.length > 0 ? local.images[0].src : null;

      return {
        id: shopify.id,
        title: local.title,
        body_html: local.body_html,
        handle: local.handle,
        vendor: local.vendor,
        product_type: local.product_type,
        images: [
          {
            src: imagen,
          },
        ],
        variants: [
          {
            id: shopify.variants[0].id,
            product_id: shopify.variants[0].product_id,
            sku: local.variants[0].sku,
            price: local.variants[0].price,
            inventory_management: local.variants[0].inventory_management,
            inventory_item_id: shopify.variants[0].inventory_item_id,
            inventory_quantity: local.variants[0].inventory_quantity,
          },
        ],
      };
    });
    const resultadosAct = [];
    for (const producto of productosAct) {
      try {
      } catch (error) {}
      //const subida = await subirProductoAShopify(producto);
      //const id = subida.product.id;
      const update = await actualizarProductoEnShopify(producto.id, producto);
      const variantsId = producto.variants[0].id;
      const updateBook = await updateVariants(variantsId, producto.variants);
      //console.log("Variants ID:", variants);
      const inventoryItemId = producto.variants[0].inventory_item_id;
      //console.log("Inventory Item ID:", inventoryItemId);
      const stock = producto.variants[0].inventory_quantity;
      //console.log("Inventory Stock: ", stock);
      const updateStockData = await updateStock(inventoryItemId, stock);
      //console.log(updateBookData);
      resultados.push(producto);
    }

    console.log(`🛠️  Proceso "Sync ON LINE Shopify": END-OK`);
  } catch (err) {
    console.error(err);
    const mensajeCorto = err?.message || err.toString();
    console.log(
      `🛠️  Proceso "Sync ON LINE de Shopify": IMCOMPLETO\nERROR= ${mensajeCorto}`
    );
    //res.status(500).json({ error: "Error al subir productos" });
  }
};

export const eliminarProductos = async (req, res) => {
  try {
    const resultado = await eliminarTodosLosProductos();
    res.json({ mensaje: "Productos eliminados exitosamente", ...resultado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar productos" });
  }
};

export const actualizarProducto = async (req, res) => {
  const { id } = req.params;
  const datos = req.body;

  try {
    const productoActualizado = await actualizarProductoEnShopify(id, datos);
    res.json({
      mensaje: "Producto actualizado",
      producto: productoActualizado,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
};
