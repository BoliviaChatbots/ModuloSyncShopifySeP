// backend/services/shopify.service.js
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { mostrarLoading, resetearLoading } from "./db.js";
dotenv.config();

// 🧩 Variables de entorno
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = "2025-04";
const BASE_URL = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}`;

const SHOPIFY_LOCATION = process.env.LOCATION_ID;

const HEADERS = {
  "Content-Type": "application/json",
  "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
};

const archivoColecciones = path.resolve("data/collectshopify.json"); // Ajusta la ruta si es necesario

export async function buscarCollectsId(nombreColeccion) {
  try {
    const data = await fs.readFile(archivoColecciones, "utf-8");
    const colecciones = JSON.parse(data);
    const coleccion = colecciones.find(
      (c) =>
        c.title
          .trim()
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") ===
        nombreColeccion
          .trim()
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
    );
    if (!coleccion) {
      console.warn(
        `⚠️ No se encontró una colección con el nombre: ${nombreColeccion}`
      );
      return null;
    }
    //Retorna el valor ID de la coleccion
    return coleccion.id;
  } catch (error) {
    console.error(
      "❌ Error leyendo o procesando el archivo de colecciones:",
      error
    );
    throw error;
  }
}

export const agregarCollectsAlProducto = async (collectionId, productId) => {
  try {
    console.log(`🔁 Agregando Coleccion al Producto ${productId}...`);
    const res = await fetch(`${BASE_URL}/collects.json`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        collect: {
          product_id: productId,
          collection_id: collectionId,
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Error al agregar coleccion:", data);
      throw new Error(data.errors || "Error al agregar coleccion");
    }

    console.log(`✅ Colección agregada`);
    return data;
  } catch (err) {
    console.error("❌ Error en addCollections:", err.message);
    throw err;
  }
};

// Función para buscar producto por HANDLE en Shopify
export async function buscarProductoPorHandle(handle) {
  console.log("⬆️ Buscando producto en Shopify:[handle]=", handle);
  const res = await fetch(`${BASE_URL}/products.json?handle=${handle}`, {
    method: "GET",
    headers: HEADERS,
    //body: JSON.stringify({ handle: `${sku}` }),
  });

  const data = await res.json();
  return data.products && data.products.length > 0 ? data.products[0] : null;
}

export const obtenerTodosLosProductosShopify = async () => {
  let url = `${BASE_URL}/products.json?limit=250`;
  const productos = [];

  while (url) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Error al obtener productos de Shopify: ${response.statusText}`
      );
    }

    const data = await response.json();
    mostrarLoading();
    productos.push(...data.products);

    // Analizar el header Link para ver si hay una siguiente página
    const linkHeader = response.headers.get("link");
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const matches = linkHeader.match(/<([^>]+)>; rel="next"/);
      url = matches ? matches[1] : null;
    } else {
      url = null; // No hay más páginas
    }
  }

  console.log("✅ 👍 ✔️");
  resetearLoading();

  return productos;
};

export const obtenerLasColeccionesShopify = async () => {
  const url = `${BASE_URL}/graphql.json`; // reemplaza con tu dominio real 69129f-4d
  const query = `query {
      collections(first: 200) {
        edges {
          node {
            id
            title  
            handle          
          }
        }
      }
    }
  `;

  console.log("🕵️  Buscando colecciones desde GraphQL en Shopify...");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      throw new Error(`❌ Error HTTP ${res.status} - ${res.statusText}`);
    }

    const responseData = await res.json();

    if (responseData.errors) {
      console.error("❌ Errores en la respuesta GraphQL:", responseData.errors);
      throw new Error("Error al consultar GraphQL");
    }

    const colecciones = responseData.data.collections.edges.map((edge) => ({
      id: Number(edge.node.id.split("/").pop()),
      title: edge.node.title,
      handle: edge.node.handle,
    }));

    console.log(`Total de Collections: `, colecciones.length);

    return colecciones;
  } catch (err) {
    console.error("❌ Error en obtenerLasColeccionesShopify:", err.message);
    throw err;
  }
};

// 🛒 1. SUBIR producto nuevo (POST)
export const subirProductoAShopify = async (producto) => {
  try {
    console.log("⬆️ Subiendo producto a Shopify...");
    const res = await fetch(`${BASE_URL}/products.json`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ product: producto }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Error al subir producto:", data);
      throw new Error(data.errors || "Error al subir producto");
    }

    console.log(
      `✅ Producto creado: ${data.product.title} (ID: ${data.product.id})`
    );
    return data;
  } catch (err) {
    console.error("❌ Error en subirProductoAShopify:", err.message);
    throw err;
  }
};

// ✏️ 2. ACTUALIZAR producto existente (PUT/POST)
//updateVariants(variants, producto.variants)
export const updateVariants = async (variantsId, variantsData) => {
  try {
    console.log(`🔁 Actualizando variante con ID ${variantsId}...`);
    const res = await fetch(`${BASE_URL}/variants/${variantsId}.json`, {
      method: "PUT",
      headers: HEADERS,
      body: JSON.stringify({
        variant: {
          id: variantsId,
          price: variantsData.price,
          sku: variantsData.sku,
          inventory_management: variantsData.inventory_management,
          inventory_policy: variantsData.inventory_policy,
          fulfillment_service: variantsData.fulfillment_service,
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Error al actualizar variante:", data);
      throw new Error(data.errors || "Error al actualizar variante");
    }

    console.log(`✅ Price actualizado:[`, data.variant.price, `]`);
    return data;
  } catch (err) {
    console.error("❌ Error en actualizarProductoEnShopify:", err.message);
    throw err;
  }
};

export const updateStock = async (variantsItemId, stock) => {
  try {
    console.log(`🔁 Actualizando stock con ID ${variantsItemId}...`);
    const res = await fetch(`${BASE_URL}/inventory_levels/set.json`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        location_id: SHOPIFY_LOCATION, // <-- tu location_id real
        inventory_item_id: variantsItemId,
        available: stock,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Error al actualizar stock:", data);
      throw new Error(data.errors || "Error al actualizar stock");
    }

    console.log(`✅ Stock actualizado:[`, stock, `]`);
    return data;
  } catch (err) {
    console.error("❌ Error en updateStock:", err.message);
    throw err;
  }
};

export const actualizarProductoEnShopify = async (id, producto) => {
  try {
    console.log(`🔁 Actualizando ID: `, id);
    const res = await fetch(`${BASE_URL}/products/${id}.json`, {
      method: "PUT",
      headers: HEADERS,
      body: JSON.stringify({ product: { ...producto, id } }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Error al actualizar producto:", data);
      throw new Error(data.errors || "Error al actualizar producto");
    }

    console.log(`✅ Producto actualizado:`, data.product.title);
    return data;
  } catch (err) {
    console.error("❌ Error en actualizarProductoEnShopify:", err.message);
    throw err;
  }
};

// 🗑️ 3. ELIMINAR producto por ID
export const eliminarProductoDeShopify = async (id) => {
  try {
    console.log(`🗑️ Eliminando producto con ID ${id}...`);
    const res = await fetch(`${BASE_URL}/products/${id}.json`, {
      method: "DELETE",
      headers: HEADERS,
    });

    if (!res.ok) {
      const data = await res.json();
      console.error("❌ Error al eliminar producto:", data);
      throw new Error(data.errors || "Error al eliminar producto");
    }

    console.log(`✅ Producto eliminado (ID: ${id})`);
    return { ok: true, id };
  } catch (err) {
    console.error("❌ Error en eliminarProductoDeShopify:", err.message);
    throw err;
  }
};

// 🔄 4. ELIMINAR 450 productos ordenas alfabeticamente ASC los productos
export const eliminarTodosLosProductos = async () => {
  try {
    console.log("⚠️ Obteniendo todos los productos para eliminarlos...");

    const res = await fetch(`${BASE_URL}/products.json?limit=250`, {
      method: "GET",
      headers: HEADERS,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Error al obtener productos:", data);
      throw new Error(data.errors || "Error al obtener productos");
    }

    const productos = data.products;
    console.log(`📦 Total productos encontrados: ${productos.length}`);

    const inicio = 0;

    for (const prod of productos) {
      await eliminarProductoDeShopify(prod.id);
    }

    console.log("✅ Todos los productos fueron eliminados.");
    return { ok: true, total: productos.length };
  } catch (err) {
    console.error("❌ Error en eliminarTodosLosProductos:", err.message);
    throw err;
  }
};
