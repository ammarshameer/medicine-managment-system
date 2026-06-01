import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const PrescriptionScreen = () => {
  const handleUploadPrescription = () => {
    Alert.alert('Upload Prescription', 'Camera and gallery functionality will be implemented');
  };

  const handleTakePhoto = () => {
    Alert.alert('Camera', 'Camera functionality will be implemented');
  };

  const handleChooseFromGallery = () => {
    Alert.alert('Gallery', 'Gallery functionality will be implemented');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Upload Prescription</Text>
        <Text style={styles.subtitle}>Upload your doctor's prescription</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.uploadSection}>
          <View style={styles.uploadIcon}>
            <Icon name="camera-alt" size={60} color="#1976d2" />
          </View>
          <Text style={styles.uploadTitle}>Take a Photo</Text>
          <Text style={styles.uploadSubtitle}>
            Capture a clear image of your prescription
          </Text>
          <TouchableOpacity style={styles.uploadButton} onPress={handleTakePhoto}>
            <Icon name="camera" size={20} color="#fff" />
            <Text style={styles.uploadButtonText}>Take Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.uploadSection}>
          <View style={styles.uploadIcon}>
            <Icon name="photo-library" size={60} color="#1976d2" />
          </View>
          <Text style={styles.uploadTitle}>Choose from Gallery</Text>
          <Text style={styles.uploadSubtitle}>
            Select an existing image from your device
          </Text>
          <TouchableOpacity style={styles.uploadButton} onPress={handleChooseFromGallery}>
            <Icon name="image" size={20} color="#fff" />
            <Text style={styles.uploadButtonText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.noteSection}>
          <Icon name="info" size={20} color="#FF9800" />
          <Text style={styles.noteText}>
            Please ensure the prescription is clearly visible and all details are readable. 
            Our pharmacist will review and approve your prescription.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  content: {
    padding: 20,
  },
  uploadSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  uploadIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    paddingHorizontal: 20,
    fontSize: 14,
    color: '#666',
  },
  noteSection: {
    flexDirection: 'row',
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 10,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    lineHeight: 20,
  },
});

export default PrescriptionScreen;
