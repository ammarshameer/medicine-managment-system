import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  FlatList
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const PrescriptionScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState(null);
  const [notes, setNotes] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState(user?.address || '');
  const [orderDirectly, setOrderDirectly] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Past prescriptions
  const [prescriptions, setPrescriptions] = useState([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(true);

  const fetchPrescriptions = async () => {
    try {
      const res = await axios.get('/prescriptions/my-prescriptions');
      setPrescriptions(res.data.data?.prescriptions || []);
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
    } finally {
      setLoadingPrescriptions(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const handleTakePhoto = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 1200,
      maxWidth: 1200,
      quality: 0.8
    };

    launchCamera(options, (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        // Fallback for emulator / mock
        setSelectedImage({
          uri: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
          name: 'camera_prescription.jpg',
          type: 'image/jpeg'
        });
        return;
      }
      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        setSelectedImage({
          uri: asset.uri,
          name: asset.fileName || 'prescription.jpg',
          type: asset.type || 'image/jpeg'
        });
      }
    });
  };

  const handleChooseFromGallery = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 1200,
      maxWidth: 1200,
      quality: 0.8
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        // Fallback for emulator / mock
        setSelectedImage({
          uri: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
          name: 'gallery_prescription.jpg',
          type: 'image/jpeg'
        });
        return;
      }
      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        setSelectedImage({
          uri: asset.uri,
          name: asset.fileName || 'prescription.jpg',
          type: asset.type || 'image/jpeg'
        });
      }
    });
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      Alert.alert('Prescription Required', 'Please take a photo or select an image from gallery');
      return;
    }

    if (orderDirectly && !deliveryAddress.trim()) {
      Alert.alert('Address Required', 'Please enter your delivery address for this order');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload prescription
      const formData = new FormData();
      formData.append('prescription', {
        uri: selectedImage.uri,
        name: selectedImage.name || 'prescription.jpg',
        type: selectedImage.type || 'image/jpeg'
      });
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }

      const uploadRes = await axios.post('/prescriptions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const prescription = uploadRes.data.data;

      // 2. If orderDirectly is checked, place prescription-only order
      if (orderDirectly) {
        await axios.post('/orders', {
          prescriptionId: prescription.id,
          deliveryAddress: deliveryAddress.trim(),
          paymentMethod: 'Cash on Delivery',
          notes: notes.trim() || 'Prescription Order - pharmacist will verify medicines'
        });

        Alert.alert(
          'Prescription Order Placed!',
          'Your prescription has been submitted. Our pharmacist will review it, prepare your medicines, and deliver to your address.',
          [{ text: 'View Orders', onPress: () => navigation.navigate('Orders') }]
        );
      } else {
        Alert.alert(
          'Prescription Uploaded',
          'Your prescription has been submitted for pharmacist review.'
        );
      }

      setSelectedImage(null);
      setNotes('');
      fetchPrescriptions();
    } catch (error) {
      console.error('Prescription submission error:', error);
      const msg = error.response?.data?.message || 'Failed to upload prescription. Please try again.';
      Alert.alert('Upload Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return { color: '#16a34a', bg: '#dcfce7', label: 'Approved' };
      case 'Rejected':
        return { color: '#dc2626', bg: '#fee2e2', label: 'Rejected' };
      case 'Pending':
      default:
        return { color: '#d97706', bg: '#fef3c7', label: 'Under Review' };
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Upload Prescription</Text>
        <Text style={styles.subtitle}>Order medicines with a photo of your doctor's slip</Text>
      </View>

      <View style={styles.content}>
        {/* Photo Selection Card */}
        <View style={styles.uploadCard}>
          {selectedImage ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={() => setSelectedImage(null)}
              >
                <Icon name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pickButtonsContainer}>
              <TouchableOpacity style={styles.actionPickButton} onPress={handleTakePhoto}>
                <View style={styles.pickIconWrapper}>
                  <Icon name="camera-alt" size={28} color="#1976d2" />
                </View>
                <Text style={styles.pickButtonText}>Camera</Text>
                <Text style={styles.pickButtonSubtext}>Take a photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionPickButton} onPress={handleChooseFromGallery}>
                <View style={styles.pickIconWrapper}>
                  <Icon name="photo-library" size={28} color="#1976d2" />
                </View>
                <Text style={styles.pickButtonText}>Gallery</Text>
                <Text style={styles.pickButtonSubtext}>Choose file</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.instructionsBox}>
            <Icon name="info-outline" size={18} color="#1976d2" />
            <Text style={styles.instructionsText}>
              Ensure doctor's signature, date, and medicine names are legible in the photo.
            </Text>
          </View>
        </View>

        {/* Order Details Form */}
        <View style={styles.formCard}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setOrderDirectly(!orderDirectly)}
          >
            <Icon
              name={orderDirectly ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={orderDirectly ? '#1976d2' : '#94a3b8'}
            />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.checkboxLabel}>Place Order with this Prescription</Text>
              <Text style={styles.checkboxSublabel}>
                The pharmacy will dispense medicines and deliver directly to you
              </Text>
            </View>
          </TouchableOpacity>

          {orderDirectly && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Delivery Address *</Text>
              <TextInput
                style={styles.inputField}
                placeholder="House, Street, Area, City"
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                multiline={true}
                numberOfLines={2}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Special Instructions / Notes</Text>
            <TextInput
              style={styles.inputField}
              placeholder="e.g. Please provide 1 month supply, contact if generic is available..."
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>
                {orderDirectly ? 'Submit & Place Prescription Order' : 'Upload for Verification'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Past Prescriptions */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Your Uploaded Prescriptions</Text>
          {loadingPrescriptions ? (
            <ActivityIndicator color="#1976d2" size="small" style={{ marginVertical: 15 }} />
          ) : prescriptions.length === 0 ? (
            <Text style={styles.noHistoryText}>No past prescriptions found.</Text>
          ) : (
            prescriptions.map((p) => {
              const badge = getStatusBadge(p.status);
              return (
                <View key={p.id} style={styles.historyCard}>
                  <View style={styles.historyIcon}>
                    <Icon name="description" size={24} color="#1976d2" />
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyId}>Prescription #{p.id}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(p.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.historyBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.historyBadgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  content: {
    padding: 16,
  },
  uploadCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  pickButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  actionPickButton: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  pickIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pickButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  pickButtonSubtext: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  previewContainer: {
    position: 'relative',
    marginBottom: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  changeImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 10,
  },
  instructionsText: {
    fontSize: 12,
    color: '#1e40af',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  checkboxSublabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputField: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  submitButton: {
    backgroundColor: '#1976d2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  historySection: {
    marginBottom: 30,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 10,
  },
  noHistoryText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyId: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  historyDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  historyBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default PrescriptionScreen;
