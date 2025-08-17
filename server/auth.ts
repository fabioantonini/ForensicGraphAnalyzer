import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, loginUserSchema } from "@shared/schema";
import { 
  generatePasswordResetToken, 
  verifyPasswordResetToken, 
  invalidatePasswordResetToken, 
  sendPasswordResetEmail,
  isEmailServiceConfigured,
  getUserIdFromResetToken
} from "./email-service";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}.${buf.toString("hex")}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [salt, hashed] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "grapholex-insight-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { confirmPassword, ...userData } = req.body;
      
      // Check if passwords match
      if (userData.password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(userData.password);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // Create an activity for the new user
      await storage.createActivity({
        userId: user.id,
        type: "signup",
        details: "User account created",
      });

      req.login(user, (err) => {
        if (err) return next(err);
        // Don't send the password back
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    try {
      const validation = loginUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid credentials format" });
      }

      passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) {
          return res.status(401).json({ message: "Invalid username or password" });
        }
        req.login(user, async (err) => {
          if (err) return next(err);
          
          // Create login activity
          await storage.createActivity({
            userId: user.id,
            type: "login",
            details: "User logged in",
          });
          
          // Don't send the password back
          const { password, ...userWithoutPassword } = user;
          return res.status(200).json(userWithoutPassword);
        });
      })(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    const userId = req.user?.id;
    req.logout((err) => {
      if (err) return next(err);
      if (userId) {
        // Create logout activity
        storage.createActivity({
          userId,
          type: "logout",
          details: "User logged out",
        }).catch(err => console.error("Failed to log logout activity:", err));
      }
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Don't send the password back
    const { password, ...userWithoutPassword } = req.user as SelectUser;
    res.json(userWithoutPassword);
  });
  
  // Endpoints per il recupero password
  app.post("/api/forgot-password", async (req, res, next) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Verifica se il servizio email è configurato
      if (!isEmailServiceConfigured()) {
        return res.status(503).json({ 
          message: "Email service is not configured. Please contact the administrator." 
        });
      }
      
      // Trova l'utente con questa email
      const user = await storage.getUserByEmail(email);
      
      // Per ragioni di sicurezza, non rivelare se l'email esiste o meno
      if (!user) {
        // Invia una risposta di successo anche se l'utente non esiste
        return res.status(200).json({ 
          message: "If your email is registered, you will receive a password reset link shortly" 
        });
      }
      
      // Genera un token per il reset della password
      const token = await generatePasswordResetToken(user.id);
      
      // Costruisci il link di reset - usa l'URL corretto per Replit
      const host = req.headers.host;
      let baseUrl;
      
      if (host && host.includes('replit')) {
        // Per Replit usa l'URL pubblico
        baseUrl = `https://${host}`;
      } else {
        // Per sviluppo locale
        baseUrl = process.env.BASE_URL || `http://${host}`;
      }
      
      const resetLink = `${baseUrl}/reset-password/${token}`;
      
      // Determina la lingua dell'utente (se disponibile, altrimenti usa l'italiano)
      const locale = 'it'; // Default to Italian since settings might not have language property
      
      // Invia l'email
      const emailSent = await sendPasswordResetEmail(email, resetLink, locale);
      
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send password reset email" });
      }
      
      // Crea un'attività per il reset della password
      await storage.createActivity({
        userId: user.id,
        type: "password_reset_request",
        details: "Password reset requested",
      });
      
      res.status(200).json({ 
        message: "If your email is registered, you will receive a password reset link shortly" 
      });
    } catch (err) {
      next(err);
    }
  });
  
  // Endpoint per verificare la validità del token di reset
  app.get("/api/verify-reset-token", async (req, res, next) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ 
          valid: false, 
          message: "Token is required" 
        });
      }
      
      // Verifica la validità del token
      const isValid = await verifyPasswordResetToken(token);
      
      if (isValid) {
        res.json({ valid: true });
      } else {
        res.status(400).json({ 
          valid: false, 
          message: "Invalid or expired token" 
        });
      }
    } catch (err) {
      next(err);
    }
  });

  // Endpoint per il reset della password
  app.post("/api/reset-password", async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ 
          message: "Token and new password are required" 
        });
      }
      
      // Verifica la validità del token
      const isValid = await verifyPasswordResetToken(token);
      
      if (!isValid) {
        return res.status(400).json({ 
          message: "Invalid or expired token" 
        });
      }
      
      // Ottieni l'ID utente dal token
      const userId = await getUserIdFromResetToken(token);
      
      if (!userId) {
        return res.status(400).json({ 
          message: "Invalid token" 
        });
      }
      
      // Hash della nuova password
      const hashedPassword = await hashPassword(newPassword);
      
      // Aggiorna la password dell'utente
      await storage.updateUserPassword(userId, hashedPassword);
      
      // Invalida il token
      await invalidatePasswordResetToken(token);
      
      // Crea un'attività per il reset della password
      await storage.createActivity({
        userId: userId,
        type: "password_reset_completed",
        details: "Password reset completed successfully",
      });
      
      res.json({ 
        message: "Password reset successfully" 
      });
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/user/api-key", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { openaiApiKey } = req.body;
      const userId = req.user!.id;
      
      const updatedUser = await storage.updateUserApiKey(userId, openaiApiKey);
      
      // Create an activity for API key update
      await storage.createActivity({
        userId: userId,
        type: "api_key_update",
        details: "OpenAI API key updated",
      });
      
      // Don't send the password back
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/user/profile", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { fullName, organization, profession } = req.body;
      const userId = req.user!.id;
      
      const updatedUser = await storage.updateUserProfile(userId, {
        fullName,
        organization,
        profession,
      });
      
      // Create an activity for profile update
      await storage.createActivity({
        userId: userId,
        type: "profile_update",
        details: "User profile updated",
      });
      
      // Don't send the password back
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/user/password", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { currentPassword, newPassword, confirmNewPassword } = req.body;
      const userId = req.user!.id;
      
      // Check if new passwords match
      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ message: "New passwords do not match" });
      }
      
      // Get the current user to verify the current password
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify the current password
      if (!await comparePasswords(currentPassword, user.password)) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update the password
      const updatedUser = await storage.updateUserPassword(userId, hashedPassword);
      
      // Create an activity for password update
      await storage.createActivity({
        userId: userId,
        type: "password_update",
        details: "User password updated",
      });
      
      // Don't send the password back
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (err) {
      next(err);
    }
  });
}
