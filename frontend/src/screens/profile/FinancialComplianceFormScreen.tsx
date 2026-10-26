import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import api from '../../services/api';
import { Chip, PremiumInput as Field, Loading, SPACE, FinanceChart3D } from '../../ui';
import { FormScreen, FormFooter, FormSection, FieldLabel, ChoicePills, k } from './formKit';
import { TURNOVER_RANGES } from '../business/companyForm/companyOptions';

type FinancialComplianceFormScreenProps = NativeStackScreenProps<RootStackParamList, 'FinancialComplianceForm'>;

/** This step's place in the older four-step flow (it sits before the declaration). */
const STEPS = ['Personal', 'Business', 'Financial', 'Declaration'];

/*
 * TURNOVER_RANGES is the shared list (companyOptions, = the website's). This
 * screen had its own copy ending at "Above 1 Crore", a band the website no
 * longer offers, so a value saved here would not show in the website's form.
 */

const GOVT_SCHEMES = [
  'Startup India',
  'MUDRA',
  'Stand-Up India',
  'PMEGP',
  'None',
  'Others',
];

const FinancialComplianceFormScreen: React.FC<FinancialComplianceFormScreenProps> = ({ navigation, route }) => {
  const k = useLegacyAppearance(sharedAppearance_k);
  const s = useLegacyAppearance(legacyAppearance_s);
  const { userData } = route.params || {};

  const [formData, setFormData] = useState({
    panNumber: '',
    gstNumber: '',
    lastYearTurnover: '',
  });
  const [itrFiled, setItrFiled] = useState<boolean | null>(null);
  const [selectedGovtSchemes, setSelectedGovtSchemes] = useState<string[]>([]);
  const [schemeDetails, setSchemeDetails] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchFinancialInfo();
  }, []);

  const fetchFinancialInfo = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/members/financial-info');
      if (response?.data?.success && response?.data?.data) {
        const data = response.data.data;
        setFormData({
          panNumber: data.panNumber || '',
          gstNumber: data.gstNumber || '',
          lastYearTurnover: data.turnoverRange || data.lastYearTurnover || '',
        });
        if (data.filedITR !== undefined) setItrFiled(data.filedITR);
        else if (data.itrFiled !== undefined) setItrFiled(data.itrFiled);

        /**
         * Read the schemes the member actually picked.
         *
         * This used to set `['Yes']` whenever `govtSchemeBenefit` was true —
         * a value that is not one of the six options, so no pill rendered as
         * selected and reopening the form looked like nothing had been saved.
         * It was a stand-in for real data: `govtSchemes` was being dropped by
         * Mongoose strict mode, so there was nothing truthful to show. The
         * field is stored now, so the real list is read back.
         */
        setSelectedGovtSchemes(Array.isArray(data.govtSchemes) ? data.govtSchemes : []);
        setSchemeDetails(data.schemeDetails || '');
      }
    } catch (error: any) {
      console.log('Notice loading financial info:', error?.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleGovtScheme = (scheme: string) => {
    setSelectedGovtSchemes((prev) =>
      prev.includes(scheme) ? prev.filter((s) => s !== scheme) : [...prev, scheme]
    );
  };

  const validatePAN = (pan: string): boolean => {
    if (!pan) return true;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  };

  const validateGST = (gst: string): boolean => {
    if (!gst) return true;
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(gst);
  };

  const handlePrevious = () => {
    navigation.goBack();
  };

  const handleNext = async () => {
    if (formData.panNumber && !validatePAN(formData.panNumber)) {
      Alert.alert('Invalid PAN', 'Please enter a valid 10-character PAN number (e.g. ABCDE1234F).');
      return;
    }

    if (formData.gstNumber && !validateGST(formData.gstNumber)) {
      Alert.alert('Invalid GST', 'Please enter a valid 15-character GSTIN number.');
      return;
    }

    setIsSaving(true);
    try {
      const isGovtBeneficiary = selectedGovtSchemes.length > 0 && !selectedGovtSchemes.includes('None');
      const financialData: any = {
        panNumber: formData.panNumber,
        gstNumber: formData.gstNumber,
        filedITR: itrFiled,
        govtSchemeBenefit: isGovtBeneficiary,
        // Legacy keys
        itrFiled,
        govtSchemes: selectedGovtSchemes,
        schemeDetails: selectedGovtSchemes.includes('Others') ? schemeDetails : undefined,
      };
      if (formData.lastYearTurnover) {
        financialData.turnoverRange = formData.lastYearTurnover;
        financialData.lastYearTurnover = formData.lastYearTurnover;
      }

      await api.put('/members/profile', financialData);

      navigation.navigate('DeclarationForm', {
        userData: { ...userData, registrationForm: { ...userData?.registrationForm, ...financialData } },
      });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save financial information');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <FormScreen title="Complete Your Profile" subtitle="Financial details" onBack={handlePrevious} step={3} steps={STEPS} art={<FinanceChart3D size={88} />}>
        <Loading label="Loading…" />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Complete Your Profile"
      subtitle="Financial details"
      onBack={handlePrevious}
      step={3}
      steps={STEPS}
      art={<FinanceChart3D size={88} />}
      footer={(
        <FormFooter
          secondaryLabel="Previous"
          onSecondary={handlePrevious}
          primaryLabel="Next"
          onPrimary={handleNext}
          loading={isSaving}
        />
      )}
    >
      {/* SECTION 1: Tax Identification */}
      <FormSection icon="receipt-long" title="Tax Identification" subtitle="Both are optional">
        <Field
          label="PAN Number"
          value={formData.panNumber}
          onChangeText={(val) => handleInputChange('panNumber', (val || '').toUpperCase())}
          placeholder="ABCDE1234F"
          maxLength={10}
          autoCapitalize="characters"
          autoCorrect={false}
          icon="credit-card"
          hint="Format: ABCDE1234F (Optional)"
        />
        <Field
          label="GSTIN Number"
          value={formData.gstNumber}
          onChangeText={(val) => handleInputChange('gstNumber', (val || '').toUpperCase())}
          placeholder="22ABCDE1234F1Z5"
          maxLength={15}
          autoCapitalize="characters"
          autoCorrect={false}
          icon="receipt"
          hint="Format: 22ABCDE1234F1Z5 (Optional)"
          style={{ marginBottom: 0 }}
        />
      </FormSection>

      {/* SECTION 2: Income Tax Returns & Turnover */}
      <FormSection icon="account-balance-wallet" title="Turnover & Compliance">
        <View style={k.fieldWrap}>
          <FieldLabel label="Have you filed Income Tax Returns (ITR)?" />
          <ChoicePills
            options={[
              { value: 'yes' as const, label: 'Yes' },
              { value: 'no' as const, label: 'No' },
            ]}
            value={itrFiled === true ? 'yes' : itrFiled === false ? 'no' : ''}
            onChange={(v) => setItrFiled(v === 'yes')}
          />
        </View>

        <View>
          <FieldLabel label="Annual Turnover Range" />
          <View style={s.chipWrap} accessibilityRole="radiogroup">
            {TURNOVER_RANGES.map((range) => (
              <Chip
                key={range}
                label={range}
                selected={formData.lastYearTurnover === range}
                onPress={() => handleInputChange('lastYearTurnover', range)}
              />
            ))}
          </View>
        </View>
      </FormSection>

      {/* SECTION 3: Government Scheme Benefits */}
      <FormSection icon="verified-user" title="Government Scheme Benefits" subtitle="Select all that apply">
        <View>
          <FieldLabel label="Beneficiary of Government Schemes?" />
          <View style={s.chipWrap}>
            {GOVT_SCHEMES.map((scheme) => (
              <Chip
                key={scheme}
                label={scheme}
                selected={(selectedGovtSchemes || []).includes(scheme)}
                onPress={() => toggleGovtScheme(scheme)}
              />
            ))}
          </View>
        </View>

        {(selectedGovtSchemes || []).includes('Others') && (
          <Field
            label="Specify Other Schemes"
            value={schemeDetails}
            onChangeText={setSchemeDetails}
            placeholder="Enter details of other government schemes"
            multiline
            numberOfLines={3}
            icon="description"
            style={{ marginTop: SPACE.lg, marginBottom: 0 }}
          />
        )}
      </FormSection>
    </FormScreen>
  );
};

const s = StyleSheet.create({
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
});

export default FinancialComplianceFormScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;

const sharedAppearance_k = k;
