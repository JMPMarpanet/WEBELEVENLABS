// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  //console.log("BODY:", req.body);

  //console.log("Supabase URL:", process.env.SUPABASE_URL);
  //console.log("Supabase Key:", process.env.SUPABASE_KEY ? "OK" : "FALTANTE");

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  //console.log("Intento de login:", username);
  //console.log("Usuario encontrado:", user);
  //console.log("Error de Supabase:", error);
  //console.log("Password", password)

  if (error || !user) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const validPassword = await bcrypt.compare(String(password), user.password);
  console.log("Contrasena valida?", validPassword);
  console.log("password", password);
  console.log("passwordUsuario", user.password);
  

  if (!validPassword) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  res.json({ success: true, is_admin: user.is_admin });
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
