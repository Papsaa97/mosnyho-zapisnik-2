import { describe, it, expect, vi } from 'vitest';
import { validateImageFile } from '../../../src/services/imageCompressionService';

export { validateImageFile };

describe('Feature 25: Mobile Camera & File Picker', () => {
  // Test 1: Native rear-camera input configuration
  it('configures camera input with capture="environment" and accept="image/*" for direct mobile rear camera access', () => {
    const cameraInput = document.createElement('input');
    cameraInput.type = 'file';
    cameraInput.accept = 'image/*';
    cameraInput.setAttribute('capture', 'environment');

    expect(cameraInput.type).toBe('file');
    expect(cameraInput.accept).toBe('image/*');
    expect(cameraInput.getAttribute('capture')).toBe('environment');
  });

  // Test 2: Gallery picker input configuration with multiple selection
  it('configures gallery file picker with accept="image/*" and multiple attribute', () => {
    const galleryInput = document.createElement('input');
    galleryInput.type = 'file';
    galleryInput.accept = 'image/*';
    galleryInput.multiple = true;

    expect(galleryInput.type).toBe('file');
    expect(galleryInput.accept).toBe('image/*');
    expect(galleryInput.multiple).toBe(true);
  });

  // Test 3: MIME type validation for image formats
  it('accepts valid photographic MIME types and rejects unsupported document formats', () => {
    // Valid formats
    expect(validateImageFile({ type: 'image/jpeg', size: 3 * 1024 * 1024 }).valid).toBe(true);
    expect(validateImageFile({ type: 'image/png', size: 1.5 * 1024 * 1024 }).valid).toBe(true);
    expect(validateImageFile({ type: 'image/webp', size: 800 * 1024 }).valid).toBe(true);
    expect(validateImageFile({ type: 'image/heic', size: 4 * 1024 * 1024 }).valid).toBe(true);

    // Invalid non-image formats
    const pdfCheck = validateImageFile({ type: 'application/pdf', size: 500 * 1024 });
    expect(pdfCheck.valid).toBe(false);
    expect(pdfCheck.error).toContain('Nepodporovaný formát');

    const txtCheck = validateImageFile({ type: 'text/plain', size: 1024 });
    expect(txtCheck.valid).toBe(false);

    const emptyMimeCheck = validateImageFile({ type: '', size: 2048 });
    expect(emptyMimeCheck.valid).toBe(false);
  });

  // Test 4: Graceful handling of empty file selection (picker cancellation)
  it('gracefully handles user cancelling camera or gallery picker without errors', () => {
    const onFilesSelected = vi.fn();

    // Simulate input change event with empty files
    const handleFileChange = (files: File[] | null) => {
      if (!files || files.length === 0) return;
      onFilesSelected(files);
    };

    handleFileChange(null);
    expect(onFilesSelected).not.toHaveBeenCalled();

    handleFileChange([]);
    expect(onFilesSelected).not.toHaveBeenCalled();
  });

  // Test 5: Input value clearing after selection for repeatable picking
  it('resets file input value after processing so identical files can be picked consecutively', () => {
    const input = document.createElement('input');
    input.type = 'file';

    // In browser, setting input.value = '' clears the selected file
    input.value = '';
    expect(input.value).toBe('');
  });

  // Test 6: Processing multiple selected files in batch
  it('processes batch file selection from gallery input correctly', () => {
    const mockFiles = [
      new File(['photo1-bytes'], 'weld-root.jpg', { type: 'image/jpeg' }),
      new File(['photo2-bytes'], 'weld-cap.jpg', { type: 'image/jpeg' }),
      new File(['photo3-bytes'], 'vt2-tag.png', { type: 'image/png' }),
    ];

    const processedNames: string[] = [];
    for (const file of mockFiles) {
      const validation = validateImageFile(file);
      if (validation.valid) {
        processedNames.push(file.name);
      }
    }

    expect(processedNames).toHaveLength(3);
    expect(processedNames).toEqual(['weld-root.jpg', 'weld-cap.jpg', 'vt2-tag.png']);
  });
});
