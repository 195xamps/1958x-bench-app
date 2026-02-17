import { useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { apiClient } from '../services';
import { API_URL, showAlert, showError } from '../utils';
import type { Attachment } from '../types';

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);

  const uploadFile = async (uri: string, fileName: string, contentType: string): Promise<string | null> => {
    try {
      setUploading(true);
      const urlResponse = await apiClient.post('/api/uploads/request-url', {
        name: fileName,
        size: 0,
        contentType,
      });
      const { uploadURL, objectPath } = urlResponse.data;

      if (Platform.OS === 'web') {
        const fileResponse = await fetch(uri);
        const uploadBody = await fileResponse.blob();
        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: uploadBody,
          headers: { 'Content-Type': contentType },
        });
        if (!uploadResponse.ok) {
          throw new Error('Upload failed with status ' + uploadResponse.status);
        }
      } else {
        const uploadResult = await FileSystem.uploadAsync(uploadURL, uri, {
          httpMethod: 'PUT',
          uploadType: 0,
          sessionType: 1,
          headers: { 'Content-Type': contentType },
        } as any);
        if (uploadResult.status < 200 || uploadResult.status >= 300) {
          throw new Error('Upload failed with status ' + uploadResult.status);
        }
      }

      return API_URL + objectPath;
    } catch (error: any) {
      console.error('[Upload] Error:', error?.message || error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async (useCamera: boolean) => {
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Camera permission is required to take photos');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Photo library permission is required');
        return;
      }
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });

    if (!result.canceled && result.assets[0]) {
      const uploadedUrl = await uploadFile(result.assets[0].uri, 'image-' + Date.now() + '.jpg', 'image/jpeg');
      if (uploadedUrl) {
        setPendingAttachments((prev) => [...prev, { type: 'image', url: uploadedUrl }]);
      } else {
        showError('Failed to upload image');
      }
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        const fileName = file.name || 'document-' + Date.now() + '.pdf';
        const uploadedUrl = await uploadFile(file.uri, fileName, 'application/pdf');
        if (uploadedUrl) {
          setPendingAttachments((prev) => [...prev, { type: 'file', url: uploadedUrl, name: fileName }]);
        } else {
          showError('Failed to upload PDF');
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      showError('Failed to pick document');
    }
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAttachments = () => {
    setPendingAttachments([]);
  };

  return {
    uploading,
    pendingAttachments,
    pickImage,
    pickDocument,
    removeAttachment,
    clearAttachments,
    uploadFile,
  };
}
