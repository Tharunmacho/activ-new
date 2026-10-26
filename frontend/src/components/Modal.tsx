import { useLegacyAppearance } from '../ui/legacyAppearance';
import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ModalProps as RNModalProps,
} from 'react-native';
import { COLORS, FONTS, SPACING } from '../theme/theme';

interface ModalProps extends RNModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  fullScreen?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  fullScreen = false,
  ...modalProps
}) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
    <RNModal
      visible={visible}
      animationType="slide"
      transparent={!fullScreen}
      onRequestClose={onClose}
      {...modalProps}
    >
      <View style={[styles.overlay, fullScreen && styles.fullScreenOverlay]}>
        <View style={[styles.modalContent, fullScreen && styles.fullScreenContent]}>
          {/* Header */}
          {(title || showCloseButton) && (
            <View style={styles.header}>
              {title && <Text style={styles.title}>{title}</Text>}
              {showCloseButton && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  fullScreenOverlay: {
    padding: 0,
    backgroundColor: COLORS.background,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fullScreenContent: {
    flex: 1,
    maxHeight: '100%',
    borderRadius: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.md,
  },
  closeButtonText: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.bold,
  },
  content: {
    padding: SPACING.lg,
  },
});

export default Modal;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
