import 'dart:io';
import 'package:flutter/material';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

class PrintPreviewScreen extends StatefulWidget {
  final File photoFile;
  final String dimensionsType; // '35x45' or '2x2'

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

    // Grid layout configurations
    // 32 photos on an A4 page (e.g. 4 columns x 8 rows)
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
                spacing: 8, // gap between photos (cut width)
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
                        // Corner cut marks
                        pw.Positioned(
                          top: 0, left: 0,
                          child: pw.Container(width: 4, height: 4, decoration: const pw.BoxDecoration(border: pw.Border(top: pw.BorderSide(width: 0.5), left: pw.BorderSide(width: 0.5)))),
                        ),
                        pw.Positioned(
                          top: 0, right: 0,
                          child: pw.Container(width: 4, height: 4, decoration: const pw.BoxDecoration(border: pw.Border(top: pw.BorderSide(width: 0.5), right: pw.BorderSide(width: 0.5)))),
                        ),
                        pw.Positioned(
                          bottom: 0, left: 0,
                          child: pw.Container(width: 4, height: 4, decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(width: 0.5), left: pw.BorderSide(width: 0.5)))),
                        ),
                        pw.Positioned(
                          bottom: 0, right: 0,
                          child: pw.Container(width: 4, height: 4, decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(width: 0.5), right: pw.BorderSide(width: 0.5)))),
                        ),
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

  Future<void> _saveAsPdf() async {
    setState(() { _isSaving = true; });
    try {
      final bytes = await _generatePdf(PdfPageFormat.a4);
      final directory = await getApplicationDocumentsDirectory();
      final path = '${directory.path}/passport_photos_a4.pdf';
      final file = File(path);
      await file.writeAsBytes(bytes);

      setState(() { _isSaving = false; });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Saved PDF successfully to: $path')),
        );
      }
    } catch (e) {
      setState(() { _isSaving = false; });
    }
  }

  Future<void> _shareFiles() async {
    final bytes = await _generatePdf(PdfPageFormat.a4);
    final directory = await getTemporaryDirectory();
    final path = '${directory.path}/passport_photos_grid.pdf';
    final file = File(path);
    await file.writeAsBytes(bytes);

    await Share.shareXFiles(
      [XFile(file.path)],
      text: 'My printable AI-generated A4 Passport Photos',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('A4 Print Preview'),
      ),
      body: Column(
        children: [
          Expanded(
            child: Container(
              color: Colors.grey[800],
              child: PdfPreview(
                build: (format) => _generatePdf(format),
                allowPrinting: true,
                allowSharing: true,
                canChangePageFormat: false,
                actions: [
                  PdfPreviewAction(
                    icon: const Icon(Icons.file_download),
                    onPressed: (context, build, format) => _saveAsPdf(),
                  )
                ],
              ),
            ),
          ),
          
          // Action Buttons Bottom Bar
          Container(
            padding: const EdgeInsets.all(16),
            color: Theme.of(context).colorScheme.surface,
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      side: BorderSide(color: Theme.of(context).colorScheme.primary),
                    ),
                    icon: const Icon(Icons.share),
                    label: const Text('Share A4 PDF'),
                    onPressed: _shareFiles,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    icon: _isSaving 
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.save_alt),
                    label: const Text('Save Printable PDF'),
                    onPressed: _isSaving ? null : _saveAsPdf,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
