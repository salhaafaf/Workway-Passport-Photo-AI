import 'dart:io';
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

  // Selected Size
  String _selectedSize = '35x45'; // '35x45' or '2x2'
  
  // Background setting
  Color _backgroundColor = Colors.white;
  double _bgTolerance = 0.35;

  // Face Enhancement sliders
  double _brightness = 1.0;
  double _contrast = 1.0;
  double _smoothing = 0.0;

  // Suit / Blazer settings
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Background updated successfully!')),
      );
    } catch (e) {
      setState(() { _isProcessing = false; });
    }
  }

  Future<void> _applyEnhancementsAndBlazer() async {
    setState(() { _isProcessing = true; });
    try {
      // 1. First enhance photo
      File processed = await _imageService.enhanceFace(
        inputFile: _currentFile,
        brightnessValue: _brightness,
        contrastValue: _contrast,
        skinSmoothing: _smoothing,
      );

      // 2. Overlay Blazer & Tie if selected
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enhancements applied!')),
      );
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
          // Upper Photo Preview Container
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
                    
                    // Guidelines indicator overlay
                    IgnorePointer(
                      child: AspectRatio(
                        aspectRatio: _targetAspect,
                        child: Container(
                          decoration: BorderBox(
                            border: Border.all(color: Colors.blue.withOpacity(0.5), width: 2),
                          ),
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
          
          // Lower Settings and Controls Section
          Expanded(
            flex: 5,
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Size Selector
                    const Text('1. SELECT PASSPORT SIZE', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: ChoiceChip(
                            label: const Text('35x45 mm (EU/UK/Asia)'),
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
                            label: const Text('2x2 inch (US/India)'),
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

                    // Background Options
                    const Text('2. BACKGROUND REMOVAL & REPLACEMENT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: Colors.black,
                            side: const BorderSide(color: Colors.grey),
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
                            backgroundColor: const Color(0xFFB0E2FF), // Sky blue
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

                    // Formal blazer option
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
                      Text('Suit Scaling: ${(_blazerScale * 100).toInt()}%'),
                      Slider(
                        min: 0.5,
                        max: 1.2,
                        value: _blazerScale,
                        onChanged: (val) {
                          setState(() { _blazerScale = val; });
                        },
                        onChangeEnd: (val) => _applyEnhancementsAndBlazer(),
                      ),
                      Text('Suit Position Height: ${(_blazerOffset * 100).toInt()}%'),
                      Slider(
                        min: 0.4,
                        max: 0.9,
                        value: _blazerOffset,
                        onChanged: (val) {
                          setState(() { _blazerOffset = val; });
                        },
                        onChangeEnd: (val) => _applyEnhancementsAndBlazer(),
                      ),
                    ],
                    const Divider(height: 24),

                    // Face Enhancement Sliders
                    const Text('4. FACE LIGHTING & ENHANCEMENT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 8),
                    Text('Brightness: ${(_brightness * 100).toInt()}%'),
                    Slider(
                      min: 0.8,
                      max: 1.4,
                      value: _brightness,
                      onChanged: (val) {
                        setState(() { _brightness = val; });
                      },
                      onChangeEnd: (val) => _applyEnhancementsAndBlazer(),
                    ),
                    Text('Contrast: ${(_contrast * 100).toInt()}%'),
                    Slider(
                      min: 0.8,
                      max: 1.4,
                      value: _contrast,
                      onChanged: (val) {
                        setState(() { _contrast = val; });
                      },
                      onChangeEnd: (val) => _applyEnhancementsAndBlazer(),
                    ),
                    Text('Skin Smoothing: ${(_smoothing * 100).toInt()}%'),
                    Slider(
                      min: 0.0,
                      max: 1.0,
                      value: _smoothing,
                      onChanged: (val) {
                        setState(() { _smoothing = val; });
                      },
                      onChangeEnd: (val) => _applyEnhancementsAndBlazer(),
                    ),
                    const SizedBox(height: 24),
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

class BorderBox extends BoxDecoration {
  const BorderBox({super.border});
}

// Custom Painter to display a passport guidance alignment mask in editor
class PassportGuidePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.red.withOpacity(0.3)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    // Draw centering hair oval guide
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(size.width / 2, size.height * 0.45),
        width: size.width * 0.45,
        height: size.height * 0.50,
      ),
      paint,
    );

    // Centering crossline
    final linePaint = Paint()
      ..color = Colors.blue.withOpacity(0.2)
      ..strokeWidth = 1;
    canvas.drawLine(Offset(size.width / 2, 0), Offset(size.width / 2, size.height), linePaint);
    canvas.drawLine(Offset(0, size.height * 0.45), Offset(size.width, size.height * 0.45), linePaint);

    // Draw chin/shoulder guides
    final shoulderPaint = Paint()
      ..color = Colors.green.withOpacity(0.3)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    
    final path = Path()
      ..moveTo(size.width * 0.2, size.height * 0.8)
      ..quadraticBezierTo(size.width * 0.3, size.height * 0.72, size.width * 0.5, size.height * 0.72)
      ..quadraticBezierTo(size.width * 0.7, size.height * 0.72, size.width * 0.8, size.height * 0.8);
    canvas.drawPath(path, shoulderPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
