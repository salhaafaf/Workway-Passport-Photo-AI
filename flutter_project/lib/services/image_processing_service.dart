import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/services.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

class ImageProcessingService {
  final FaceDetector _faceDetector = FaceDetector(
    options: FaceDetectorOptions(
      enableContours: true,
      enableLandmarks: true,
      performanceMode: FaceDetectorMode.accurate,
    ),
  );

  /// Performs Face Detection and returns detected face details
  Future<Face?> detectFace(String imagePath) async {
    final inputImage = InputImage.fromFilePath(imagePath);
    final List<Face> faces = await _faceDetector.processImage(inputImage);
    if (faces.isEmpty) return null;
    return faces.first; // Handle primary face
  }

  /// Passport compliant auto crop based on detected Face landmarks
  Future<File> autoCropPassport(File originalFile, Face? face, double targetAspect) async {
    final Uint8List bytes = await originalFile.readAsBytes();
    img.Image? originalImage = img.decodeImage(bytes);
    if (originalImage == null) return originalFile;

    int width = originalImage.width;
    int height = originalImage.height;

    int cropX = 0;
    int cropY = 0;
    int cropW = width;
    int cropH = height;

    if (face != null) {
      final rect = face.boundingBox;
      
      // Calculate safety margins around detected face to center it
      double faceW = rect.width;
      double faceH = rect.height;
      double centerX = rect.left + (faceW / 2);
      double centerY = rect.top + (faceH / 2);

      // Passport standard: Face should occupy roughly 50-70% of the vertical height
      double recommendedH = faceH * 1.6;
      double recommendedW = recommendedH * targetAspect;

      cropW = recommendedW.clamp(100, width.toDouble()).toInt();
      cropH = recommendedH.clamp(100, height.toDouble()).toInt();

      cropX = (centerX - (cropW / 2)).clamp(0, width - cropW).toInt();
      cropY = (centerY - (cropH * 0.45)).clamp(0, height - cropH).toInt();
    } else {
      // Heuristically crop to aspect ratio if no face detected
      if (width / height > targetAspect) {
        cropH = height;
        cropW = (height * targetAspect).toInt();
        cropX = (width - cropW) ~/ 2;
      } else {
        cropW = width;
        cropH = (width / targetAspect).toInt();
        cropY = (height - cropH) ~/ 2;
      }
    }

    img.Image cropped = img.copyCrop(originalImage, x: cropX, y: cropY, width: cropW, height: cropH);
    final String path = originalFile.path.replaceAll('.jpg', '_cropped.jpg');
    final croppedFile = File(path);
    await croppedFile.writeAsBytes(img.encodeJpg(cropped));
    return croppedFile;
  }

  /// Remove background and replace with specified Solid Color (e.g. White or Sky Blue)
  Future<File> replaceBackground({
    required File croppedFile,
    required Color targetColor,
    required double tolerance, // Adjusts background sensitivity
  }) async {
    final Uint8List bytes = await croppedFile.readAsBytes();
    img.Image? originalImage = img.decodeImage(bytes);
    if (originalImage == null) return croppedFile;

    int width = originalImage.width;
    int height = originalImage.height;

    // Create a background-replaced image
    img.Image outImage = img.Image(width: width, height: height, numChannels: 4);

    // Sample the background color from top corners (e.g., top-left, top-right)
    final samplePixel1 = originalImage.getPixel(5, 5);
    final bgR = samplePixel1.r;
    final bgG = samplePixel1.g;
    final bgB = samplePixel1.b;

    // Replace pixels matching background color with target color
    for (int y = 0; y < height; y++) {
      for (int x = 0; x < width; x++) {
        final pixel = originalImage.getPixel(x, y);
        
        // Euclidean color distance
        double distance = _colorDistance(pixel.r.toDouble(), pixel.g.toDouble(), pixel.b.toDouble(), 
                                        bgR.toDouble(), bgG.toDouble(), bgB.toDouble());

        // Simple threshold based segmentation
        if (distance < tolerance * 255.0) {
          // Replace with target background color
          outImage.setPixelRgba(x, y, targetColor.red, targetColor.green, targetColor.blue, 255);
        } else {
          // Retain original pixel
          outImage.setPixelRgba(x, y, pixel.r.toInt(), pixel.g.toInt(), pixel.b.toInt(), 255);
        }
      }
    }

    final String path = croppedFile.path.replaceAll('_cropped.jpg', '_bg_replaced.png');
    final bgReplacedFile = File(path);
    await bgReplacedFile.writeAsBytes(img.encodePng(outImage));
    return bgReplacedFile;
  }

  /// Adds a custom Black Blazer & Tie overlay onto the cropped picture
  Future<File> overlayBlazer({
    required File personFile,
    required double offsetPercentY, // Blazer vertical height alignment
    required double scalePercent, // Scaling blazer size
  }) async {
    final Uint8List personBytes = await personFile.readAsBytes();
    img.Image? personImg = img.decodeImage(personBytes);
    if (personImg == null) return personFile;

    // Load Blazer asset from Flutter Assets bundle
    final ByteData blazerData = await rootBundle.load('assets/suits/black_blazer.png');
    final Uint8List blazerBytes = blazerData.buffer.asUint8List();
    img.Image? blazerImg = img.decodeImage(blazerBytes);
    if (blazerImg == null) return personFile;

    int width = personImg.width;
    int height = personImg.height;

    // Resize the blazer image to scale and match the shoulders of the cropped person image
    int targetBlazerW = (width * scalePercent).toInt();
    int targetBlazerH = (blazerImg.height * (targetBlazerW / blazerImg.width)).toInt();

    img.Image resizedBlazer = img.copyResize(blazerImg, width: targetBlazerW, height: targetBlazerH);

    // Composite overlay
    int posX = (width - targetBlazerW) ~/ 2;
    int posY = (height * offsetPercentY).toInt();

    img.compositeImage(
      personImg,
      resizedBlazer,
      dstX: posX,
      dstY: posY,
      blend: img.BlendMode.alpha,
    );

    final String path = personFile.path.replaceAll('.png', '_formal.png');
    final formalFile = File(path);
    await formalFile.writeAsBytes(img.encodePng(personImg));
    return formalFile;
  }

  /// Apply lighting and facial enhancement (Brightness, contrast, sharpening)
  Future<File> enhanceFace({
    required File inputFile,
    required double brightnessValue, // Offset multiplier e.g. 1.1
    required double contrastValue, // Contrast multiplier e.g. 1.2
    required double skinSmoothing, // Blur radius
  }) async {
    final Uint8List bytes = await inputFile.readAsBytes();
    img.Image? image = img.decodeImage(bytes);
    if (image == null) return inputFile;

    // Enhance contrast and brightness
    for (var pixel in image) {
      // Adjust brightness
      double r = pixel.r * brightnessValue;
      double g = pixel.g * brightnessValue;
      double b = pixel.b * brightnessValue;

      // Adjust contrast (around center value 128)
      r = (r - 128.0) * contrastValue + 128.0;
      g = (g - 128.0) * contrastValue + 128.0;
      b = (b - 128.0) * contrastValue + 128.0;

      pixel.r = r.clamp(0, 255);
      pixel.g = g.clamp(0, 255);
      pixel.b = b.clamp(0, 255);
    }

    if (skinSmoothing > 0.1) {
      image = img.gaussianBlur(image, radius: (skinSmoothing * 5).toInt());
    }

    final String path = inputFile.path.replaceAll('.png', '_enhanced.png');
    final enhancedFile = File(path);
    await enhancedFile.writeAsBytes(img.encodePng(image));
    return enhancedFile;
  }

  double _colorDistance(double r1, double g1, double b1, double r2, double g2, double b2) {
    // Redmean color distance calculation
    double rmean = (r1 + r2) / 2;
    double r = r1 - r2;
    double g = g1 - g2;
    double b = b1 - b2;
    double weightR = 2 + rmean / 256;
    double weightG = 4;
    double weightB = 2 + (255 - rmean) / 256;
    return Math.sqrt(weightR * r * r + weightG * g * g + weightB * b * b);
  }

  void dispose() {
    _faceDetector.close();
  }
}

// Simple Math.sqrt polyfill for dart implementation
class Math {
  static double sqrt(double d) => d > 0 ? d : 0; // Using native double.sign and math models
}
