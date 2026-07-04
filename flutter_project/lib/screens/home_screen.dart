import 'dart:io';
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

      // Perform fast face-detection to prepare for crop
      final face = await _imageService.detectFace(pickedFile.path);

      if (!mounted) return;
      setState(() { _isLoading = false; });

      // Navigate to editing dashboard
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
          SnackBar(content: Text('Error picking image: $e')),
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
                  
                  // Primary Interaction Buttons
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
                  
                  // Guidelines / Sizes info badge
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
  }
}
