import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Linking,
  TouchableHighlight,
} from 'react-native';
import GradientBackground from '../components/GradientBackground';
import AdBanner from '../components/AdBanner';
import { COLORS } from '../theme/colors';

const ContactScreen: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSendMessage = () => {
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // In a real app, you would send this to your backend
    Alert.alert(
      'Message Sent',
      'Thank you for your message! We will get back to you soon.',
      [{
        text: 'OK', onPress: () => {
          setName('');
          setEmail('');
          setSubject('');
          setMessage('');
        }
      }]
    );
  };

  const handleEmailPress = () => {
    Linking.openURL('mailto:contact@naturi.sm');
  };

  const handlePhonePress = () => {
    Linking.openURL('tel:+493089201707');
  };

  const handleSocialPress = (platform: string) => {
    const urls = {
      facebook: 'https://facebook.com/naturismapp',
      twitter: 'https://twitter.com/naturismapp',
      instagram: 'https://instagram.com/naturismapp',
    };
    Linking.openURL(urls[platform as keyof typeof urls]);
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Contact Us</Text>
            <Text style={styles.subtitle}>
              Our app was published for the first time in 2018. We realize them in
              a small team alongside our jobs and without an investor or large
              financial background. It should get better step by step. Our claim
              as naturists is only to implement what we use ourselves. Please help
              us to improve the app and send us feedback.
            </Text>
          </View>

          <View style={styles.contactInfo}>
            <Text style={styles.sectionTitle}>Get in Touch</Text>

            <TouchableOpacity style={styles.contactItem} onPress={handleEmailPress}>
              <Text style={styles.contactIcon}>📧</Text>
              <View style={styles.contactDetails}>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue}>kontakt@natourist.com</Text>
              </View>
            </TouchableOpacity>

            {/* <TouchableOpacity style={styles.contactItem} onPress={handlePhonePress}>
            <Text style={styles.contactIcon}>📞</Text>
            <View style={styles.contactDetails}>
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={styles.contactValue}>+49.30-89201707</Text>
            </View>
          </TouchableOpacity> */}

            <View style={[styles.contactItem, styles.contactItemLast]}>
              <Text style={styles.contactIcon}>📍</Text>
              <View style={styles.contactDetails}>
                <Text style={styles.contactLabel}>Address</Text>
                <Text style={styles.contactValue}>Jan-Erik-Nord</Text>
                <Text style={styles.contactValue}>Waldstrasse 42</Text>
                <Text style={styles.contactValue}>13156 Berlin, Germany</Text>
              </View>
            </View>
          </View>

          {/* <View style={styles.socialSection}>
          <Text style={styles.sectionTitle}>Follow Us</Text>
          <View style={styles.socialButtons}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialPress('facebook')}
            >
              <Text style={styles.socialIcon}>📘</Text>
              <Text style={styles.socialText}>Facebook</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialPress('twitter')}
            >
              <Text style={styles.socialIcon}>🐦</Text>
              <Text style={styles.socialText}>Twitter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialPress('instagram')}
            >
              <Text style={styles.socialIcon}>📷</Text>
              <Text style={styles.socialText}>Instagram</Text>
            </TouchableOpacity>
          </View>
        </View> */}

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Send us a Message</Text>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Your Name"
                placeholderTextColor={COLORS.text.secondary}
                value={name}
                onChangeText={setName}
              />

              <TextInput
                style={styles.input}
                placeholder="Your Email"
                placeholderTextColor={COLORS.text.secondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TextInput
                style={styles.input}
                placeholder="Subject"
                placeholderTextColor={COLORS.text.secondary}
                value={subject}
                onChangeText={setSubject}
              />

              <TextInput
                style={[styles.input, styles.messageInput]}
                placeholder="Your Message"
                placeholderTextColor={COLORS.text.secondary}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                <Text style={styles.sendButtonText}>Send Message</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bannerSection}>
            <AdBanner style={styles.banner} />
          </View>

          <View style={styles.faqSection}>
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>How do I add a new place?</Text>
              <Text style={styles.faqAnswer}>
                You can suggest new places by contacting us through this form or email. We review all suggestions and add them to our database.
              </Text>
            </View>

            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>Is the app free to use?</Text>
              <Text style={styles.faqAnswer}>
                Yes, our app is completely free to use. We believe in making naturist-friendly places accessible to everyone.
              </Text>
            </View>

            <View style={[styles.faqItem, styles.faqItemLast]}>
              <Text style={styles.faqQuestion}>How often is the information updated?</Text>
              <Text style={styles.faqAnswer}>
                We regularly update our database with new places and information. If you notice outdated information, please let us know.
              </Text>
            </View>
          </View>

          <View style={styles.privacySection}>
            <Text style={styles.privacyTitle}>
              Privacy Policy :{' '}
            </Text>
            <TouchableHighlight
              onPress={() =>
                Linking.openURL('https://natourist.com/privacy-policy')
              }
              underlayColor="transparent"
            >
              <Text style={styles.privacyLink}>
                https://natourist.com/privacy-policy
              </Text>
            </TouchableHighlight>
          </View>

          {/* Legal / Imprint Section
        <View style={styles.imprintSection}>
          <View style={styles.imprintContainer}>
            <Text style={styles.imprintSectionTitle}>Legal Information</Text>
            
            <View style={styles.imprintInfoBlock}>
              <View style={styles.imprintRow}>
                <Text style={[styles.imprintHeading, styles.imprintBold]}>Geschäftsführer:</Text>
                <Text style={styles.imprintText}> Jan-Erik Nord</Text>
              </View>
              <View style={styles.imprintColumn}>
                <Text style={[styles.imprintHeading, styles.imprintBold, styles.imprintCentered]}>
                  Amtsgericht Charlottenburg:
                </Text>
                <Text style={styles.imprintText}> HRB 193156 B</Text>
              </View>
              <View style={styles.imprintRow}>
                <Text style={styles.imprintHeading}>USt.-ID-Nr:</Text>
                <Text style={styles.imprintText}> DE316829839</Text>
              </View>
            </View> 

            <View style={styles.privacySection}>
              <Text style={styles.privacyTitle}>
                Privacy Policy :{' '}
              </Text>
              <TouchableHighlight
                onPress={() =>
                  Linking.openURL('https://naturi.sm/#imprint-privacy-policy')
                }
                underlayColor="transparent"
              >
                <Text style={styles.privacyLink}>
                  https://naturi.sm/#imprint-privacy-policy
                </Text>
              </TouchableHighlight>
            </View>
          </View>
        </View>
*/}
          <View style={styles.bannerSectionBottom}>
            <AdBanner style={styles.banner} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary.darkPurple,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.primary.blue,
    lineHeight: 24,
  },
  contactInfo: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  contactItemLast: {
    borderBottomWidth: 0,
  },
  contactIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  contactDetails: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 16,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  socialSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 12,
  },
  socialButton: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    minWidth: 90,
    borderWidth: 1,
    borderColor: 'rgba(58, 47, 107, 0.12)',
  },
  socialIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  socialText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: '600',
  },
  formSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  form: {
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text.primary,
    backgroundColor: COLORS.white,
  },
  messageInput: {
    minHeight: 120,
    paddingTop: 14,
  },
  sendButton: {
    backgroundColor: COLORS.primary.teal,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: COLORS.primary.teal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonText: {
    color: COLORS.text.onDark,
    fontSize: 16,
    fontWeight: '600',
  },
  bannerSection: {
    marginTop: 20,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  bannerSectionBottom: {
    marginTop: 16,
    marginBottom: 24,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  banner: {
    overflow: 'hidden',
    borderRadius: 8,
  },
  faqSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  faqItem: {
    marginBottom: 20,
  },
  faqItemLast: {
    marginBottom: 0,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: COLORS.text.secondary,
    lineHeight: 22,
  },
  imprintSection: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  imprintContainer: {
    backgroundColor: COLORS.white,
    width: '100%',
    alignSelf: 'center',
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  imprintSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  imprintHeading: {
    fontSize: 16,
    color: COLORS.text.primary,
    lineHeight: 24,
  },
  imprintBold: {
    fontWeight: 'bold',
  },
  imprintCentered: {
    textAlign: 'center',
  },
  imprintInfoBlock: {
    marginTop: 16,
  },
  imprintText: {
    fontSize: 16,
    color: COLORS.text.primary,
    lineHeight: 24,
  },
  imprintRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  imprintColumn: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  privacySection: {
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    width: '90%',
    alignSelf: 'center',
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  privacyLink: {
    fontSize: 15,
    color: COLORS.primary.teal,
    textDecorationLine: 'underline',
  },
});

export default ContactScreen;
