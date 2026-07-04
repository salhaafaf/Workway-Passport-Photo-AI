export interface FaceLandmark {
  x: number;
  y: number;
}

export interface BoundingBox {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface FaceDetectionResult {
  faceDetected: boolean;
  boundingBox: BoundingBox;
  landmarks: {
    leftEye: FaceLandmark;
    rightEye: FaceLandmark;
    noseTip: FaceLandmark;
    mouthCenter: FaceLandmark;
    chin: FaceLandmark;
  };
  recommendedCrop: BoundingBox & { reason?: string };
  backgroundRemoval?: {
    suggestedBackgroundType?: string;
    backgroundColorHex?: string;
    clothingColor?: string;
  };
}

export type PassportSize = "35x45" | "2x2";

export interface EditorSettings {
  size: PassportSize;
  backgroundColor: "white" | "skyblue" | "transparent";
  brightness: number; // 0.8 - 1.4
  contrast: number; // 0.8 - 1.4
  saturation: number; // 0.8 - 1.4
  skinSmoothing: number; // 0 - 100
  addBlazer: boolean;
  blazerScale: number; // 0.5 - 1.5
  blazerX: number; // offset X
  blazerY: number; // offset Y
}

export interface FlutterFile {
  name: string;
  path: string;
  language: "dart" | "yaml" | "xml" | "gradle";
  content: string;
}
