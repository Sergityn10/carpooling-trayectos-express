import dotenv from "dotenv";
dotenv.config();
const USUARIOS_URL = process.env.USUARIOS_URL;
async function authenticate(req, res, next) {
    console.log(req.cookies.access_token)
    const token = req.cookies.access_token;
    console.log(token)
    if (!token) {
        return res.status(401).send({status: "Error", message: "No se proporcionó un token de acceso"});
    }

    // 2. Construir el header 'Cookie'
    const cookieHeaderValue = `access_token=${token}`; // El formato debe ser 'nombre=valor'

    fetch(`${USUARIOS_URL}/api/auth/validate`, {
        method: "GET",
        // 'credentials: "include"' le dice a fetch que envíe cookies/headers de autenticación
        credentials: "include", 
        
        // 🔑 AÑADIR HEADERS: Aquí es donde incluyes el header 'Cookie' manualmente
        headers: {
            'Cookie': cookieHeaderValue
        }
    })
    .then(async response => {
        if (!response.ok) {
            const body = await response.json()
            throw new Error(`${body.message}`);
        }
        return response.json();
    })
    .then(data => {
        req.user = data.data;
        next();
    })
    .catch(error => {
        console.error("Error al validar el token:", error);
        return res.status(401).send({status: "Error", message: "No se proporcionó un token de acceso válido"});
    });
}

export const utilsAuthentication = {
    authenticate
}