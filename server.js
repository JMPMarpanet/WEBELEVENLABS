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

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !user) {
    return res.status(401).json({ error: "Usuario no existe" });
  }

  //bcrypt.hash(String(password), 10).then(hash => console.log("Nuevo hash:", hash));


  const validPassword = await bcrypt.compare(String(password), user.password);

  if (!validPassword) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  res.json({ success: true, is_admin: user.is_admin, username: user.username });
});

app.get("/signed-url", async (req, res) => {
  try {
    const agentId = process.env.AGENT_ID;
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { "xi-api-key": process.env.ELEVENLABS_KEY } }
    );
    if (!resp.ok) throw new Error(await resp.text());
    const body = await resp.json();
    res.json({ signed_url: body.signed_url });
  } catch (err) {
    console.error("Error getting signed URL", err);
    res.status(500).json({ error: "No se pudo generar signed_url" });
  }
});

app.get("/AgenteDeVoz", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "AgenteDeVoz.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/menu", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "menu.html"));
});


// API: Obtener todos los usuarios (sin contraseña)
app.get("/api/users", async (req, res) => {
  const { data, error } = await supabase.from("users").select("id, username, is_admin, telegram");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// API: Crear nuevo usuario
app.post("/api/users", async (req, res) => {
  const { username, password, is_admin, telegram } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const { error } = await supabase.from("users").insert([
    { username, password: hashedPassword, is_admin, telegram }
  ]);

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ message: "Usuario creado" });
});

// API: Eliminar usuario por ID
app.delete("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Usuario eliminado" });
});

// API: Registrar inicio de conversación
app.post("/api/log-conversation", async (req, res) => {
  const { username, user_agent, timezone, started_at  } = req.body;
  const { error } = await supabase.from("conversation_logs").insert([
    { username, user_agent, timezone, started_at }
  ]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ message: "Conversación registrada" });
});

app.post("/api/change-password", async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (userError || !user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const valid = await bcrypt.compare(String(currentPassword), user.password);
  if (!valid) {
    return res.status(401).json({ error: "Contraseña actual incorrecta" });
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);

  const { error: updateError } = await supabase
    .from("users")
    .update({ password: hashedNewPassword })
    .eq("username", username);

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  res.json({ message: "Contraseña actualizada correctamente" });
});

// API: Actualizar Telegram y Contraseña
app.put("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const { telegram, newPassword } = req.body;
  const updates = {};

  if (telegram !== undefined) {
    updates.telegram = telegram;
  }
  if (newPassword) {
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    updates.password = hashedNewPassword;
  }

  const { error } = await supabase.from("users").update(updates).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Usuario actualizado" });
});



app.listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
