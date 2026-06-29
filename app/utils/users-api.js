import dotenv from "dotenv";

dotenv.config();
const USUARIOS_URL = process.env.USUARIOS_URL;

async function fetchUserPublicInfo(userId, { headers = {} } = {}) {
  if (!userId) return null;
  try {
    const res = await fetch(`${USUARIOS_URL}/api/users/${userId}/info`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...headers },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data ?? null;
  } catch (e) {
    console.error("Error fetching user public info:", e?.message ?? e);
    return null;
  }
}

async function fetchUserByEmail(email, { headers = {} } = {}) {
  if (!email) return null;
  try {
    const res = await fetch(`${USUARIOS_URL}/api/users/email/${email}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...headers },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data ?? null;
  } catch (e) {
    console.error("Error fetching user by email:", e?.message ?? e);
    return null;
  }
}

async function fetchUserEmail(userId, { headers = {} } = {}) {
  const data = await fetchUserPublicInfo(userId, { headers });
  return data?.email ?? null;
}

async function fetchUserName(userId, { headers = {} } = {}) {
  const data = await fetchUserPublicInfo(userId, { headers });
  return data?.name ?? null;
}

async function fetchUserImgPerfil(userId, { headers = {} } = {}) {
  const data = await fetchUserPublicInfo(userId, { headers });
  return data?.img_perfil ?? null;
}

async function fetchUserStripeAccount(userId, { headers = {} } = {}) {
  if (!userId) return null;
  try {
    const res = await fetch(`${USUARIOS_URL}/api/payment/stripe-connect`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...headers },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.account?.id ?? null;
  } catch (e) {
    console.error("Error fetching user stripe account:", e?.message ?? e);
    return null;
  }
}

async function fetchUsersByIds(userIds, { headers = {} } = {}) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const results = await Promise.all(
    ids.map(async (id) => {
      const data = await fetchUserPublicInfo(id, { headers });
      if (!data) return null;
      return {
        id,
        name: data.name,
        img_perfil: data.img_perfil,
        email: data.email,
      };
    }),
  );

  return results.filter(Boolean);
}

export const UsersAPI = {
  fetchUserPublicInfo,
  fetchUserByEmail,
  fetchUserEmail,
  fetchUserName,
  fetchUserImgPerfil,
  fetchUserStripeAccount,
  fetchUsersByIds,
};
