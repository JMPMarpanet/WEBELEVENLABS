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

// Traer de variables el Webhook de n8n
app.get("/webhook-url", (req, res) => {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return res.status(500).json({ error: "Webhook no configurado" });
  res.json({ webhook: url });
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

app.get("/historial", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "historial.html"));
});

app.get("/adminReportes", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "adminReportes.html"));
});

app.get("/misReportes", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "misReportes.html"));
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

// API: Agregar al chatlog del chat con AI
app.post("/api/chat-log", async (req, res) => {
  const { usuario, pregunta, respuesta, creado_en } = req.body;

  const es_imagen = respuesta.startsWith("data:image/");

  const { error } = await supabase
    .from("chat_logs")
    .insert([{ usuario, pregunta, respuesta, creado_en, es_imagen }]);

  if (error) {
    console.error("Error guardando chat:", error.message);
    return res.status(500).json({ error: "No se pudo guardar el mensaje" });
  }

  res.status(201).json({ message: "Mensaje guardado" });
});

//Traer las ultimas conversaciones del chat
app.get("/api/chat-log", async (req, res) => {
  const { usuario } = req.query;

  if (!usuario) {
    return res.status(400).json({ error: "Falta el parámetro 'usuario'" });
  }

  const { data, error } = await supabase
    .from("chat_logs")
    .select("pregunta, respuesta, creado_en")
    .eq("usuario", usuario)
    .order("creado_en", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error al obtener historial:", error.message);
    return res.status(500).json({ error: "No se pudo obtener historial" });
  }

  res.json(data.reverse()); // Para mostrarlo en orden cronológico
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

// GET: Obtener todos los reportes
app.get("/api/reportes", async (req, res) => {
  const { data, error } = await supabase.from("reportes_powerbi").select("*").order("id");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST: Agregar un nuevo reporte
app.post("/api/reportes", async (req, res) => {
  const { nombre, report_id, group_id, grupo, activo } = req.body;
  const { error } = await supabase.from("reportes_powerbi").insert([
    { nombre, report_id, group_id, grupo, activo }
  ]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ message: "Reporte agregado" });
});

// PUT: Editar un reporte
app.put("/api/reportes/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, report_id, group_id, grupo, activo } = req.body;
  const { error } = await supabase.from("reportes_powerbi")
    .update({ nombre, report_id, group_id, grupo, activo })
    .eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Reporte actualizado" });
});

// DELETE: Eliminar un reporte
app.delete("/api/reportes/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("reportes_powerbi").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Reporte eliminado" });
});

// GET: Listar asignaciones con nombre del reporte
app.get("/api/asignaciones", async (req, res) => {
  const { data, error } = await supabase
    .from("usuarios_reportes")
    .select("id, usuario, id_reporte, reportes_powerbi(nombre, grupo)")
    .order("id");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST: Asignar reporte a usuario
app.post("/api/asignaciones", async (req, res) => {
  const { usuario, id_reporte } = req.body;
  const { error } = await supabase
    .from("usuarios_reportes")
    .insert([{ usuario, id_reporte }]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ message: "Asignación guardada" });
});

// DELETE: Eliminar asignación
app.delete("/api/asignaciones/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("usuarios_reportes").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Asignación eliminada" });
});


// ==========================
// HISTORIAL DE CONSULTAS
// ==========================

// 1. Volumen total por canal
app.get("/api/historial/volumen", async (req, res) => {
  try {
    const [chat, telegram, voz] = await Promise.all([
      supabase
        .from("chat_logs")
        .select("creado_en", { count: "exact", head: false }),

      supabase
        .from("conversacion_agente")
        .select("created_at", { count: "exact", head: false }),

      supabase
        .from("conversation_logs")
        .select("started_at", { count: "exact", head: false }),
    ]);

    res.json({
      chat: chat.count || 0,
      telegram: telegram.count || 0,
      voz: voz.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: "Error consultando volumen" });
  }
});

// 2. Chat desde web
app.get("/api/historial/chat-log", async (req, res) => {
  const { usuario, desde, hasta } = req.query;

  const query = supabase
    .from("chat_logs")
    .select("*")
    .order("creado_en", { ascending: true });

  if (usuario) query.eq("usuario", usuario);
  if (desde) query.gte("creado_en", desde);
  if (hasta) query.lte("creado_en", hasta);

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 3. Conversación por Telegram (n8n)
app.get("/api/historial/conversacion-agente", async (req, res) => {
  const { usuario, desde, hasta } = req.query;

  const query = supabase
    .from("conversacion_agente")
    .select("*")
    .order("created_at", { ascending: true });

  if (usuario) query.eq("usuario", usuario);
  if (desde) query.gte("created_at", desde);
  if (hasta) query.lte("created_at", hasta);

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });

  const parsed = data.map(row => {
    let texto = row.mensaje;

    if (row.fuente === "Agente") {
      try {
        const json = JSON.parse(row.mensaje);
        texto = json.output || row.mensaje;
      } catch {
        // dejar el texto original si no es JSON
      }
    }

    return {
      ...row,
      texto
    };
  });

  res.json(parsed);
});

// 4. Agente de voz ejecutado
app.get("/api/historial/conversation-log", async (req, res) => {
  const { usuario, desde, hasta } = req.query;

  const query = supabase
    .from("conversation_logs")
    .select("*")
    .order("started_at", { ascending: true });

  if (usuario) query.eq("username", usuario);
  if (desde) query.gte("started_at", desde);
  if (hasta) query.lte("started_at", hasta);

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
