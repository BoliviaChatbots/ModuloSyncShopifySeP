import express from "express";
import {
  obtenerProductos,
  subirProductos,
  eliminarProductos,
  obtenerAllProductos,
} from "../controllers/productos.controller.js";

const router = express.Router();

router.get("/allbd", obtenerProductos);
router.get("/allshop", obtenerAllProductos);
router.post("/subir", subirProductos);
router.delete("/eliminar", eliminarProductos);

export default router;
