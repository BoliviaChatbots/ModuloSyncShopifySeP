import express from "express";
import productosRoutes from "./routes/productos.routes.js";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/productos", productosRoutes);

const PORT = process.env.PORT || 3030;
app.listen(PORT, () =>
  console.log(`Servidor habilitado en http://localhost:${PORT}`)
);

const main = 3;
