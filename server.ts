import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Increase payload size limits for base64 images
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Initialize Gemini AI Client lazily to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not defined. AI features will fallback to client-side heuristics.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// AI Face Detection and Passport Crop Helper API
app.post("/api/gemini/face-detect", async (req, res) => {
  try {
    const { image } = req.body; // Expects base64 data URL or pure base64 string
    if (!image) {
       res.status(400).json({ error: "Missing image data." });
       return;
    }

    const ai = getAiClient();
    if (!ai) {
       res.status(503).json({
        error: "Gemini API client not configured",
        fallback: true
      });
      return;
    }

    // Clean base64 string
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `
      Analyze this passport/portrait photo. Perform professional passport photo face detection and alignment.
      Identify the bounding boxes and key landmarks of the primary face.
      All coordinate values must be percentages from 0.0 to 100.0 relative to the image size (where 0,0 is top-left and 100,100 is bottom-right).

      Return a JSON object matching this schema:
      {
        "faceDetected": true,
        "boundingBox": {
          "top": number,
          "left": number,
          "bottom": number,
          "right": number
        },
        "landmarks": {
          "leftEye": { "x": number, "y": number },
          "rightEye": { "x": number, "y": number },
          "noseTip": { "x": number, "y": number },
          "mouthCenter": { "x": number, "y": number },
          "chin": { "x": number, "y": number }
        },
        "recommendedCrop": {
          "top": number,
          "left": number,
          "bottom": number,
          "right": number,
          "reason": string
        },
        "backgroundRemoval": {
          "suggestedBackgroundType": "solid_light" | "cluttered" | "outdoor",
          "backgroundColorHex": string,
          "clothingColor": string
        }
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        },
        prompt
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            faceDetected: { type: Type.BOOLEAN },
            boundingBox: {
              type: Type.OBJECT,
              properties: {
                top: { type: Type.NUMBER },
                left: { type: Type.NUMBER },
                bottom: { type: Type.NUMBER },
                right: { type: Type.NUMBER }
              },
              required: ["top", "left", "bottom", "right"]
            },
            landmarks: {
              type: Type.OBJECT,
              properties: {
                leftEye: {
                  type: Type.OBJECT,
                  properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                  required: ["x", "y"]
                },
                rightEye: {
                  type: Type.OBJECT,
                  properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                  required: ["x", "y"]
                },
                noseTip: {
                  type: Type.OBJECT,
                  properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                  required: ["x", "y"]
                },
                mouthCenter: {
                  type: Type.OBJECT,
                  properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                  required: ["x", "y"]
                },
                chin: {
                  type: Type.OBJECT,
                  properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                  required: ["x", "y"]
                }
              },
              required: ["leftEye", "rightEye", "noseTip", "mouthCenter", "chin"]
            },
            recommendedCrop: {
              type: Type.OBJECT,
              properties: {
                top: { type: Type.NUMBER },
                left: { type: Type.NUMBER },
                bottom: { type: Type.NUMBER },
                right: { type: Type.NUMBER },
                reason: { type: Type.STRING }
              },
              required: ["top", "left", "bottom", "right"]
            },
            backgroundRemoval: {
              type: Type.OBJECT,
              properties: {
                suggestedBackgroundType: { type: Type.STRING },
                backgroundColorHex: { type: Type.STRING },
                clothingColor: { type: Type.STRING }
              }
            }
          },
          required: ["faceDetected", "boundingBox", "landmarks", "recommendedCrop"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error in face-detect API:", error);
    res.status(500).json({ error: error.message || "Failed to process face detection." });
  }
});

// AI Background removal guide / segment helper API
app.post("/api/gemini/remove-bg", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
       res.status(400).json({ error: "Missing image data." });
       return;
    }

    const ai = getAiClient();
    if (!ai) {
       res.status(503).json({
        error: "Gemini API client not configured",
        fallback: true
      });
      return;
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `
      You are an advanced portrait segmenter. Analyze the person in this image.
      Provide a outline path (polygon vertices of percentages 0.0 to 100.0) that traces the silhouette of the person (including hair, face, neck, shoulders, and shirt/garment) to cut them out from the background.
      Provide between 20 to 30 points starting from the bottom-left edge, going up around the shoulders, head, hair, other shoulder, down to bottom-right edge, and closed at bottom-left.

      Return a JSON object:
      {
        "polygonPoints": [
          { "x": number, "y": number }
        ],
        "backgroundColorHint": string,
        "hairEdgeComplexity": "simple" | "fuzzy" | "spiky"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        },
        prompt
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            polygonPoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER }
                },
                required: ["x", "y"]
              }
            },
            backgroundColorHint: { type: Type.STRING },
            hairEdgeComplexity: { type: Type.STRING }
          },
          required: ["polygonPoints"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error in remove-bg API:", error);
    res.status(500).json({ error: error.message || "Failed to segment background." });
  }
});

// Setup development or production environment
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    // Import Vite dynamically for development
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built static assets
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Passport Photo AI Server running at http://localhost:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error("Failed to start server:", err);
});
