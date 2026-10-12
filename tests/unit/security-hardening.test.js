import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { utilsAuthentication } from "../../app/utils/authentication.js";

// Generar par de claves RSA para pruebas criptográficas
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

describe("Seguridad DAST - Hardening Criptográfico y Control de Acceso", () => {
  describe("CRIT-01: Prohibición estricta de algoritmo 'none' y algoritmos no autorizados", () => {
    it("debe rechazar tokens con alg: 'none'", () => {
      // Simular ataque de bypass con alg: 'none'
      const unsignedPayload = {
        userId: "hacker-user-id",
        role: "admin",
      };
      const headerB64 = Buffer.from(
        JSON.stringify({ alg: "none", typ: "JWT" }),
      ).toString("base64url");
      const payloadB64 = Buffer.from(
        JSON.stringify(unsignedPayload),
      ).toString("base64url");
      const maliciousToken = `${headerB64}.${payloadB64}.`;

      assert.throws(
        () => {
          utilsAuthentication.verifyToken(maliciousToken);
        },
        (err) => {
          return (
            err.name === "JsonWebTokenError" ||
            err.message.includes("algorithm") ||
            err.message.includes("invalid")
          );
        },
      );
    });

    it("debe rechazar tokens simétricos (HS256) falsificados", () => {
      // Ataque de confusión de clave (usando clave pública como clave simétrica)
      const forgedToken = jwt.sign(
        { userId: "attacker-user-id", role: "admin" },
        "shared-secret",
        { algorithm: "HS256" },
      );

      assert.throws(
        () => {
          utilsAuthentication.verifyToken(forgedToken);
        },
        (err) => {
          return (
            err.name === "JsonWebTokenError" ||
            err.message.includes("algorithm")
          );
        },
      );
    });
  });

  describe("CRIT-02: Integridad de Firma y Normalización de Usuario", () => {
    it("debe rechazar un token cuya firma no coincida con la clave pública configurada", () => {
      // Generar otro par de claves para forjar firma
      const otherPair = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      const rogueToken = jwt.sign(
        { userId: "rogue-admin", role: "admin" },
        otherPair.privateKey,
        { algorithm: "RS256" },
      );

      assert.throws(
        () => {
          utilsAuthentication.verifyToken(rogueToken);
        },
        (err) => {
          return (
            err.name === "JsonWebTokenError" ||
            err.message.includes("invalid signature")
          );
        },
      );
    });

    it("debe normalizar id y userId por igual desde el payload verificado", () => {
      const normalizedWithUserId = utilsAuthentication.normalizeUserContext({
        userId: "uuid-1234",
        role: "admin",
        email: "admin@youconnext.es",
      });

      assert.strictEqual(normalizedWithUserId.id, "uuid-1234");
      assert.strictEqual(normalizedWithUserId.userId, "uuid-1234");
      assert.strictEqual(normalizedWithUserId.role, "admin");

      const normalizedWithId = utilsAuthentication.normalizeUserContext({
        id: "uuid-5678",
        role: "user",
      });

      assert.strictEqual(normalizedWithId.id, "uuid-5678");
      assert.strictEqual(normalizedWithId.userId, "uuid-5678");
      assert.strictEqual(normalizedWithId.role, "user");
    });

    it("debe rechazar payload sin userId ni id válido", () => {
      const invalidContext = utilsAuthentication.normalizeUserContext({
        role: "user",
      });
      assert.strictEqual(invalidContext, null);
    });
  });

  describe("Middleware de Autorización y Ownership (ABAC / BOLA)", () => {
    it("requireRole debe permitir solo usuarios con el rol adecuado", () => {
      const middleware = utilsAuthentication.requireRole(["admin"]);

      let calledNext = false;
      const reqAdmin = { user: { id: "1", role: "admin" } };
      const res = {
        status: (code) => ({
          send: (body) => ({ code, body }),
        }),
      };
      const next = () => {
        calledNext = true;
      };

      middleware(reqAdmin, res, next);
      assert.strictEqual(calledNext, true);

      calledNext = false;
      let deniedStatus = null;
      const resForbidden = {
        status: (code) => {
          deniedStatus = code;
          return { send: () => {} };
        },
      };
      const reqUser = { user: { id: "2", role: "user" } };
      middleware(reqUser, resForbidden, next);
      assert.strictEqual(calledNext, false);
      assert.strictEqual(deniedStatus, 403);
    });

    it("requireOwnership debe permitir al propietario del recurso", () => {
      const middleware = utilsAuthentication.requireOwnership(
        (req) => req.params.id,
      );

      let calledNext = false;
      const reqOwner = {
        user: { id: "user-abc", role: "user" },
        params: { id: "user-abc" },
      };
      const res = {};
      const next = () => {
        calledNext = true;
      };

      middleware(reqOwner, res, next);
      assert.strictEqual(calledNext, true);
    });

    it("requireOwnership debe permitir al admin independientemente del propietario", () => {
      const middleware = utilsAuthentication.requireOwnership(
        (req) => req.params.id,
      );

      let calledNext = false;
      const reqAdmin = {
        user: { id: "admin-1", role: "admin" },
        params: { id: "user-other" },
      };
      const res = {};
      const next = () => {
        calledNext = true;
      };

      middleware(reqAdmin, res, next);
      assert.strictEqual(calledNext, true);
    });

    it("requireOwnership debe denegar (403) a un tercero que intente acceder al recurso de otro", () => {
      const middleware = utilsAuthentication.requireOwnership(
        (req) => req.params.id,
      );

      let calledNext = false;
      let statusCode = null;
      const reqStranger = {
        user: { id: "stranger-99", role: "user" },
        params: { id: "victim-1" },
      };
      const res = {
        status: (code) => {
          statusCode = code;
          return { send: () => {} };
        },
      };
      const next = () => {
        calledNext = true;
      };

      middleware(reqStranger, res, next);
      assert.strictEqual(calledNext, false);
      assert.strictEqual(statusCode, 403);
    });
  });
});
