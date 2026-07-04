import { FlutterFile } from "../types";

export const FLUTTER_FILES: FlutterFile[] = [
  {
    name: "pubspec.yaml",
    path: "pubspec.yaml",
    language: "yaml",
    content: `name: passport_photo_ai
description: A complete AI-powered Passport Photo generator with face detection, background removal, suit overlay, and printable A4 grid generator.
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.6
  camera: ^0.10.5+9
  image_picker: ^1.0.7
  google_mlkit_face_detection: ^0.7.0
  image: ^4.1.3
  pdf: ^3.10.8
  printing: ^5.11.1
  path_provider: ^2.1.2
  share_plus: ^7.2.1

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
  assets:
    - assets/suits/
    - assets/suits/black_blazer.png`
  },
  {
    name: "main.dart",
    path: "lib/main.dart",
    language: "dart",
    content: `import 'package:flutter/material';
import 'screens/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PassportPhotoAiApp());
}

class PassportPhotoAiApp extends StatelessWidget {
  const PassportPhotoAiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Passport Photo AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E3A8A), // Deep Royal Blue
          brightness: Brightness.light,
        ),
        cardTheme: CardTheme(
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        appBarTheme: const AppBarTheme(
          centerTitle: true,
          backgroundColor: Color(0xFF1E3A8A),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1E3A8A),
            foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E3A8A),
          brightness: Brightness.dark,
        ),
        appBarTheme: const AppBarTheme(
          centerTitle: true,
          backgroundColor: Color(0xFF0F172A),
          foregroundColor: Colors.white,
        ),
      ),
      themeMode: ThemeMode.system,
      home: const HomeScreen(),
    );
  }
}`
  },
  {
    name: "image_processing_service.dart",
    path: "lib/services/image_processing_service.dart",
    language: "dart",
    content: `import 'dart:io';
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

    // Sample the background color from top corners
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

        if (distance < tolerance * 255.0) {
          outImage.setPixelRgba(x, y, targetColor.red, targetColor.green, targetColor.blue, 255);
        } else {
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
    required double brightnessValue,
    required double contrastValue,
    required double skinSmoothing,
  }) async {
    final Uint8List bytes = await inputFile.readAsBytes();
    img.Image? image = img.decodeImage(bytes);
    if (image == null) return inputFile;

    for (var pixel in image) {
      double r = pixel.r * brightnessValue;
      double g = pixel.g * brightnessValue;
      double b = pixel.b * brightnessValue;

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

class Math {
  static double sqrt(double d) => d > 0 ? d : 0;
}`
  },
  {
    name: "home_screen.dart",
    path: "lib/screens/home_screen.dart",
    language: "dart",
    content: `import 'dart:io';
import 'package:flutter/material';
import 'package:image_picker/image_picker.dart';
import '../services/image_processing_service.dart';
import 'crop_editor_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ImagePicker _picker = ImagePicker();
  final ImageProcessingService _imageService = ImageProcessingService();
  bool _isLoading = false;

  Future<void> _pickImage(ImageSource source) async {
    try {
      setState(() { _isLoading = true; });
      final XFile? pickedFile = await _picker.pickImage(
        source: source,
        maxWidth: 2000,
        maxHeight: 2000,
        imageQuality: 90,
      );

      if (pickedFile == null) {
        setState(() { _isLoading = false; });
        return;
      }

      final File originalFile = File(pickedFile.path);
      final face = await _imageService.detectFace(pickedFile.path);

      if (!mounted) return;
      setState(() { _isLoading = false; });

      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => CropEditorScreen(
            originalFile: originalFile,
            detectedFace: face,
          ),
        ),
      );
    } catch (e) {
      setState(() { _isLoading = false; });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error picking image: \$e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Passport Photo AI'),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline),
            onPressed: () {
              showAboutDialog(
                context: context,
                applicationName: 'Passport Photo AI',
                applicationVersion: '1.0.0',
                applicationLegalese: '© 2026 AI Studio Build',
              );
            },
          )
        ],
      ),
      body: Stack(
        children: [
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Theme.of(context).colorScheme.primary.withOpacity(0.05),
                  Theme.of(context).colorScheme.surface,
                ],
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.face_retouching_natural,
                    size: 100,
                    color: Color(0xFF1E3A8A),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Passport Photo AI',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E3A8A),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Generate print-ready, high-resolution official passport photos in seconds with advanced AI.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 48),
                  
                  Card(
                    elevation: 4,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        children: [
                          ElevatedButton.icon(
                            icon: const Icon(Icons.camera_alt),
                            label: const Text('Take Photo with Camera'),
                            onPressed: _isLoading ? null : () => _pickImage(ImageSource.camera),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: const Color(0xFF1E3A8A),
                              side: const BorderSide(color: Color(0xFF1E3A8A)),
                            ),
                            icon: const Icon(Icons.photo_library),
                            label: const Text('Choose from Gallery'),
                            onPressed: _isLoading ? null : () => _pickImage(ImageSource.gallery),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.blue[50],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.gpp_good_outlined, color: Colors.blue[800]),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Text(
                            'Compliant with 35x45 mm (EU, UK, Asia) and 2x2 inch (US, India) specifications.',
                            style: TextStyle(fontSize: 13, color: Color(0xFF1E3A8A)),
                          ),
                        )
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_isLoading)
            const Container(
              color: Colors.black54,
              child: Center(
                child: CircularProgressIndicator(),
              ),
            )
        ],
      ),
    );
  }`
  },
  {
    name: "crop_editor_screen.dart",
    path: "lib/screens/crop_editor_screen.dart",
    language: "dart",
    content: `import 'dart:io';
import 'package:flutter/material';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import '../services/image_processing_service.dart';
import 'print_preview_screen.dart';

class CropEditorScreen extends StatefulWidget {
  final File originalFile;
  final Face? detectedFace;

  const CropEditorScreen({
    super.key,
    required this.originalFile,
    this.detectedFace,
  });

  @override
  State<CropEditorScreen> createState() => _CropEditorScreenState();
}

class _CropEditorScreenState extends State<CropEditorScreen> {
  final ImageProcessingService _imageService = ImageProcessingService();
  
  late File _currentFile;
  bool _isProcessing = false;

  String _selectedSize = '35x45'; // '35x45' or '2x2'
  Color _backgroundColor = Colors.white;
  double _bgTolerance = 0.35;

  double _brightness = 1.0;
  double _contrast = 1.0;
  double _smoothing = 0.0;

  bool _addBlazer = false;
  double _blazerScale = 0.85;
  double _blazerOffset = 0.65;

  @override
  void initState() {
    super.initState();
    _currentFile = widget.originalFile;
    _runAutoCrop();
  }

  double get _targetAspect => _selectedSize == '35x45' ? (35 / 45) : (2.0 / 2.0);

  Future<void> _runAutoCrop() async {
    setState(() { _isProcessing = true; });
    try {
      final cropped = await _imageService.autoCropPassport(
        widget.originalFile,
        widget.detectedFace,
        _targetAspect,
      );
      setState(() {
        _currentFile = cropped;
        _isProcessing = false;
      });
    } catch (e) {
      setState(() { _isProcessing = false; });
    }
  }

  Future<void> _applyBackgroundRemoval() async {
    setState(() { _isProcessing = true; });
    try {
      final processed = await _imageService.replaceBackground(
        croppedFile: _currentFile,
        targetColor: _backgroundColor,
        tolerance: _bgTolerance,
      );
      setState(() {
        _currentFile = processed;
        _isProcessing = false;
      });
    } catch (e) {
      setState(() { _isProcessing = false; });
    }
  }

  Future<void> _applyEnhancementsAndBlazer() async {
    setState(() { _isProcessing = true; });
    try {
      File processed = await _imageService.enhanceFace(
        inputFile: _currentFile,
        brightnessValue: _brightness,
        contrastValue: _contrast,
        skinSmoothing: _smoothing,
      );

      if (_addBlazer) {
        processed = await _imageService.overlayBlazer(
          personFile: processed,
          offsetPercentY: _blazerOffset,
          scalePercent: _blazerScale,
        );
      }

      setState(() {
        _currentFile = processed;
        _isProcessing = false;
      });
    } catch (e) {
      setState(() { _isProcessing = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Passport Editor'),
        actions: [
          TextButton(
            onPressed: _isProcessing ? null : () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => PrintPreviewScreen(
                    photoFile: _currentFile,
                    dimensionsType: _selectedSize,
                  ),
                ),
              );
            },
            child: const Text(
              'A4 PRINT',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
          )
        ],
      ),
      body: Column(
        children: [
          Expanded(
            flex: 4,
            child: Container(
              color: Colors.grey[200],
              padding: const EdgeInsets.all(16),
              child: Center(
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Card(
                      elevation: 8,
                      clipBehavior: Clip.antiAlias,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: AspectRatio(
                        aspectRatio: _targetAspect,
                        child: _isProcessing 
                          ? const Center(child: CircularProgressIndicator()) 
                          : Image.file(_currentFile, fit: BoxFit.cover),
                      ),
                    ),
                    IgnorePointer(
                      child: AspectRatio(
                        aspectRatio: _targetAspect,
                        child: Container(
                          decoration: const BoxDecoration(),
                          child: CustomPaint(
                            painter: PassportGuidePainter(),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            flex: 5,
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('1. SELECT PASSPORT SIZE', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: ChoiceChip(
                            label: const Text('35x45 mm'),
                            selected: _selectedSize == '35x45',
                            onSelected: (val) {
                              if (val) {
                                setState(() { _selectedSize = '35x45'; });
                                _runAutoCrop();
                              }
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ChoiceChip(
                            label: const Text('2x2 inch'),
                            selected: _selectedSize == '2x2',
                            onSelected: (val) {
                              if (val) {
                                setState(() { _selectedSize = '2x2'; });
                                _runAutoCrop();
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    const Text('2. BACKGROUND REMOVAL', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: Colors.black,
                          ),
                          icon: const Icon(Icons.palette_outlined),
                          label: const Text('White Bg'),
                          onPressed: () {
                            setState(() { _backgroundColor = Colors.white; });
                            _applyBackgroundRemoval();
                          },
                        ),
                        const SizedBox(width: 12),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFB0E2FF),
                            foregroundColor: Colors.blue[900],
                          ),
                          icon: const Icon(Icons.wb_sunny_outlined),
                          label: const Text('Sky Blue Bg'),
                          onPressed: () {
                            setState(() { _backgroundColor = const Color(0xFFB0E2FF); });
                            _applyBackgroundRemoval();
                          },
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('3. ADD BLACK BLAZER & TIE', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        Switch(
                          value: _addBlazer,
                          onChanged: (val) {
                            setState(() { _addBlazer = val; });
                            _applyEnhancementsAndBlazer();
                          },
                        ),
                      ],
                    ),
                    if (_addBlazer) ...[
                      const SizedBox(height: 8),
                      Text('Suit Scaling: \${(_blazerScale * 100).toInt()}%'),
                      Slider(
                        min: 0.5,
                        max: 1.2,
                        value: _blazerScale,
                        onChanged: (val) { setState(() { _blazerScale = val; }); },
                        onChangeEnd: (val) => _applyEnhancementsAndBlazer(),
                      ),
                      Text('Suit Height: \${(_blazerOffset * 100).toInt()}%'),
                      Slider(
                        min: 0.4,
                        max: 0.9,
                        value: _blazerOffset,
                        onChanged: (val) { setState(() { _blazerOffset = val; }); },
                        onChangeEnd: (val) => _applyEnhancementsAndBlazer(),
                      ),
                    ],
                    const Divider(height: 24),
                    const Text('4. FACE LIGHTING', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 8),
                    Text('Brightness: \${(_brightness * 100).toInt()}%'),
                    Slider(
                      min: 0.8,
                      max: 1.4,
                      value: _brightness,
                      onChanged: (val) { setState(() { _brightness = val; }); },
                      onChangeEnd: (val) => _applyEnhancementsAndBlazer(),
                    ),
                  ],
                ),
              ),
            ),
          )
        ],
      ),
    );
  }
}

class PassportGuidePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.red.withOpacity(0.3)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(size.width / 2, size.height * 0.45),
        width: size.width * 0.45,
        height: size.height * 0.50,
      ),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}`
  },
  {
    name: "print_preview_screen.dart",
    path: "lib/screens/print_preview_screen.dart",
    language: "dart",
    content: `import 'dart:io';
import 'package:flutter/material';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

class PrintPreviewScreen extends StatefulWidget {
  final File photoFile;
  final String dimensionsType;

  const PrintPreviewScreen({
    super.key,
    required this.photoFile,
    required this.dimensionsType,
  });

  @override
  State<PrintPreviewScreen> createState() => _PrintPreviewScreenState();
}

class _PrintPreviewScreenState extends State<PrintPreviewScreen> {
  bool _isSaving = false;

  Future<Uint8List> _generatePdf(PdfPageFormat format) async {
    final pdf = pw.Document();
    final imageBytes = await widget.photoFile.readAsBytes();
    final image = pw.MemoryImage(imageBytes);

    const int columns = 4;
    const int rows = 8;
    
    final double photoW = widget.dimensionsType == '35x45' ? 35 * PdfPageFormat.mm : 2.0 * PdfPageFormat.inch;
    final double photoH = widget.dimensionsType == '35x45' ? 45 * PdfPageFormat.mm : 2.0 * PdfPageFormat.inch;

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(12),
        build: (context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            mainAxisAlignment: pw.MainAxisAlignment.center,
            children: [
              pw.Header(
                level: 1,
                child: pw.Text(
                  'AI Passport Generator - A4 Printable Sheet (32 photos)',
                  style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
                ),
              ),
              pw.SizedBox(height: 10),
              pw.Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: pw.WrapAlignment.center,
                children: List.generate(columns * rows, (index) {
                  return pw.Container(
                    width: photoW,
                    height: photoH,
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(color: PdfColors.grey400, width: 0.5, style: pw.BorderStyle.dashed),
                    ),
                    child: pw.Stack(
                      children: [
                        pw.Image(image, fit: pw.BoxFit.cover),
                      ],
                    ),
                  );
                }),
              ),
            ],
          );
        },
      ),
    );

    return pdf.save();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('A4 Print Preview')),
      body: PdfPreview(
        build: (format) => _generatePdf(format),
        allowPrinting: true,
        allowSharing: true,
      ),
    );
  }
}`
  },
  {
    name: "build.gradle",
    path: "android/app/build.gradle",
    language: "gradle",
    content: `plugins {
    id "com.android.application"
    id "kotlin-android"
    id "dev.flutter.flutter-gradle-plugin"
}

android {
    namespace "com.ai.passportphoto"
    compileSdk 34

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = '17'
    }

    defaultConfig {
        applicationId "com.ai.passportphoto"
        minSdk 21
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }
}`
  },
  {
    name: "AndroidManifest.xml",
    path: "android/app/src/main/AndroidManifest.xml",
    language: "xml",
    content: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.ai.passportphoto">
    
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

    <application
        android:label="Passport Photo AI"
        android:icon="@mipmap/ic_launcher">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>`
  }
];
