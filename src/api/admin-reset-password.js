export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    const { email, newPassword, adminToken } = req.body || {};

    // Proteção simples para não virar endpoint aberto
    if (!adminToken || adminToken !== process.env.ADMIN_RESET_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!email || !newPassword) {
      return res.status(400).json({ error: "Missing email or newPassword" });
    }

    const url = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return res.status(500).json({ error: "Missing server env vars" });
    }

    // 1) Busca usuário por email
    const listResp = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      method: "GET",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    if (!listResp.ok) {
      const t = await listResp.text();
      return res.status(listResp.status).json({ error: "Failed to find user", details: t });
    }

    const listData = await listResp.json();
    const user = Array.isArray(listData?.users) ? listData.users[0] : null;

    if (!user?.id) {
      return res.status(404).json({ error: "User not found" });
    }

    // 2) Atualiza senha do usuário
    const updResp = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });

    if (!updResp.ok) {
      const t = await updResp.text();
      return res.status(updResp.status).json({ error: "Failed to update password", details: t });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
}
