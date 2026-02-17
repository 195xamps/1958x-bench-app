import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

interface AttachmentPickerProps {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onLibrary: () => void;
  onDocument: () => void;
}

/**
 * On iOS, this uses ActionSheetIOS instead of a modal.
 * Call showAttachmentOptions() to handle the platform difference.
 */
export function showAttachmentOptions(
  onCamera: () => void,
  onLibrary: () => void,
  onDocument: () => void,
  showModal: () => void,
) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Take Photo', 'Choose from Library', 'Choose PDF'],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) onCamera();
        else if (buttonIndex === 2) onLibrary();
        else if (buttonIndex === 3) onDocument();
      }
    );
  } else {
    showModal();
  }
}

export function AttachmentPickerModal({
  visible,
  onClose,
  onCamera,
  onLibrary,
  onDocument,
}: AttachmentPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Add Attachment</Text>
          <TouchableOpacity style={styles.option} onPress={onCamera}>
            <Ionicons name="camera" size={24} color={colors.accent} />
            <Text style={styles.optionText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={onLibrary}>
            <Ionicons name="images" size={24} color={colors.accent} />
            <Text style={styles.optionText}>Choose from Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={onDocument}>
            <Ionicons name="document-text" size={24} color={colors.accent} />
            <Text style={styles.optionText}>Choose PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  optionText: {
    color: colors.text.bright,
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 12,
    padding: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
});
