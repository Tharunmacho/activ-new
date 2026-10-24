import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { PremiumInput, PremiumSelect, PALETTE, SPACE, TYPE } from '../../../ui';
import { RegistrationAnswers, RegistrationField } from './bookingForm';

export function RegistrationFields({ fields, answers, errors, onChange }: {
  fields: RegistrationField[]; answers: RegistrationAnswers; errors: Record<string, string>;
  onChange: (key: string, value: string | boolean) => void;
}) {
  return <>{fields.map(field => {
    const value = answers[field.key];
    const error = errors[`responses.${field.key}`];
    const label = field.label || field.key;
    if (field.type === 'checkbox') return <View key={field.key} style={styles.checkbox}>
      <View style={{ flex: 1 }}><Text style={styles.label}>{label}{field.required ? ' *' : ''}</Text>{field.helpText ? <Text style={styles.hint}>{field.helpText}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}</View>
      <Switch value={value === true || value === 'true'} onValueChange={next => onChange(field.key, next)} accessibilityLabel={label} />
    </View>;
    if (field.type === 'select') return <PremiumSelect key={field.key} label={label} required={field.required} value={String(value || '')} options={field.options || []} onChange={next => onChange(field.key, next)} placeholder={field.placeholder || 'Select an option'} hint={field.helpText} error={error} />;
    return <PremiumInput key={field.key} label={label} required={field.required} value={String(value ?? '')} onChangeText={next => onChange(field.key, next)}
      placeholder={field.placeholder || (field.type === 'date' ? 'YYYY-MM-DD' : '')} hint={field.helpText || (field.type === 'date' ? 'Year-month-day, for example 2026-10-23' : undefined)}
      maxLength={2000} multiline={field.type === 'textarea'} error={error}
      keyboardType={field.type === 'email' ? 'email-address' : field.type === 'number' ? 'decimal-pad' : field.type === 'phone' ? 'phone-pad' : 'default'}
      autoCapitalize={field.type === 'email' ? 'none' : 'sentences'} autoCorrect={field.type !== 'email'} />;
  })}</>;
}
const styles = StyleSheet.create({ checkbox: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.md }, label: { ...TYPE.label }, hint: { ...TYPE.caption, marginTop: SPACE.xs }, error: { ...TYPE.caption, color: PALETTE.redDark, marginTop: SPACE.xs } });
