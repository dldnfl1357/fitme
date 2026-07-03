import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Measurements = {
  height: string;
  weight: string;
  shoulder: string;
  chest: string;
  waist: string;
  hip: string;
  inseam: string;
  arm: string;
};

type Garment = {
  id: string;
  brand: string;
  name: string;
  price: string;
  category: 'Top' | 'Bottom' | 'Outer';
  color: string;
  accent: string;
  imageTone: string;
  sizes: {
    label: string;
    chest?: number;
    shoulder?: number;
    waist?: number;
    hip?: number;
    length: number;
  }[];
};

const initialMeasurements: Measurements = {
  height: '168',
  weight: '58',
  shoulder: '39',
  chest: '86',
  waist: '70',
  hip: '94',
  inseam: '74',
  arm: '57',
};

const garments: Garment[] = [
  {
    id: 'novel-shirt',
    brand: 'Aderline',
    name: 'Crisp Poplin Shirt',
    price: 'KRW 129,000',
    category: 'Top',
    color: '#0F172A',
    accent: '#69D2C8',
    imageTone: '#E9F8F6',
    sizes: [
      { label: 'XS', chest: 88, shoulder: 38, length: 62 },
      { label: 'S', chest: 94, shoulder: 40, length: 65 },
      { label: 'M', chest: 100, shoulder: 42, length: 68 },
      { label: 'L', chest: 106, shoulder: 44, length: 71 },
    ],
  },
  {
    id: 'curve-denim',
    brand: 'Nohant Fit',
    name: 'Curve Straight Denim',
    price: 'KRW 158,000',
    category: 'Bottom',
    color: '#1D4ED8',
    accent: '#FFB84D',
    imageTone: '#EDF4FF',
    sizes: [
      { label: '24', waist: 66, hip: 90, length: 98 },
      { label: '26', waist: 70, hip: 94, length: 100 },
      { label: '28', waist: 74, hip: 98, length: 101 },
      { label: '30', waist: 78, hip: 102, length: 103 },
    ],
  },
  {
    id: 'city-blazer',
    brand: 'Mitte',
    name: 'Soft Structure Blazer',
    price: 'KRW 248,000',
    category: 'Outer',
    color: '#3B2F2F',
    accent: '#F45D48',
    imageTone: '#FFF1EE',
    sizes: [
      { label: 'S', chest: 96, shoulder: 40, length: 67 },
      { label: 'M', chest: 102, shoulder: 42, length: 70 },
      { label: 'L', chest: 108, shoulder: 44, length: 73 },
    ],
  },
];

const fields: { key: keyof Measurements; label: string; unit: string }[] = [
  { key: 'height', label: '키', unit: 'cm' },
  { key: 'weight', label: '몸무게', unit: 'kg' },
  { key: 'shoulder', label: '어깨', unit: 'cm' },
  { key: 'chest', label: '가슴', unit: 'cm' },
  { key: 'waist', label: '허리', unit: 'cm' },
  { key: 'hip', label: '엉덩이', unit: 'cm' },
  { key: 'inseam', label: '인심', unit: 'cm' },
  { key: 'arm', label: '팔길이', unit: 'cm' },
];

const bodyTypes = ['슬림', '균형', '하체 발달', '상체 발달'];
const preferences = ['타이트', '정핏', '여유', '오버핏'];

const toNumber = (value: string) => Number(value.replace(/[^0-9.]/g, '')) || 0;

function getFitScore(measurements: Measurements, garment: Garment, preference: string) {
  const chest = toNumber(measurements.chest);
  const shoulder = toNumber(measurements.shoulder);
  const waist = toNumber(measurements.waist);
  const hip = toNumber(measurements.hip);
  const idealEase = preference === '타이트' ? 3 : preference === '정핏' ? 7 : preference === '여유' ? 11 : 16;

  const scored = garment.sizes.map((size) => {
    const checks = [
      size.chest ? Math.abs(size.chest - chest - idealEase) : null,
      size.shoulder ? Math.abs(size.shoulder - shoulder - 2) * 1.6 : null,
      size.waist ? Math.abs(size.waist - waist - (preference === '타이트' ? 1 : 3)) * 1.4 : null,
      size.hip ? Math.abs(size.hip - hip - (preference === '타이트' ? 2 : 5)) : null,
    ].filter((value): value is number => value !== null);

    const averageDelta = checks.reduce((sum, value) => sum + value, 0) / checks.length;
    return { ...size, score: Math.max(52, Math.round(99 - averageDelta * 7)) };
  });

  return scored.sort((a, b) => b.score - a.score)[0];
}

function fitStatus(delta: number) {
  if (delta < -4) return { label: '타이트', color: '#F45D48' };
  if (delta > 9) return { label: '여유', color: '#2F80ED' };
  return { label: '좋음', color: '#119C83' };
}

export default function App() {
  const [measurements, setMeasurements] = useState(initialMeasurements);
  const [bodyType, setBodyType] = useState('균형');
  const [preference, setPreference] = useState('정핏');
  const [selectedId, setSelectedId] = useState(garments[0].id);

  const selected = garments.find((garment) => garment.id === selectedId) ?? garments[0];
  const recommendation = useMemo(
    () => getFitScore(measurements, selected, preference),
    [measurements, selected, preference],
  );

  const chestEase = recommendation.chest ? recommendation.chest - toNumber(measurements.chest) : undefined;
  const waistEase = recommendation.waist ? recommendation.waist - toNumber(measurements.waist) : undefined;
  const hipEase = recommendation.hip ? recommendation.hip - toNumber(measurements.hip) : undefined;
  const shoulderEase = recommendation.shoulder
    ? recommendation.shoulder - toNumber(measurements.shoulder)
    : undefined;

  const completion = Math.round(
    (Object.values(measurements).filter((value) => toNumber(value) > 0).length / fields.length) * 100,
  );

  const updateMeasurement = (key: keyof Measurements, value: string) => {
    setMeasurements((current) => ({ ...current, [key]: value }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>FitMe Studio</Text>
            <Text style={styles.title}>내 몸에 맞춰 입어보기</Text>
          </View>
          <View style={styles.scorePill}>
            <Text style={styles.scoreIcon}>◎</Text>
            <Text style={styles.scoreText}>{completion}%</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroLabel}>Body profile</Text>
            <Text style={styles.heroTitle}>상세 치수로 브랜드별 실제 핏을 예측합니다.</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{bodyType}</Text>
                <Text style={styles.metaLabel}>체형</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{preference}</Text>
                <Text style={styles.metaLabel}>선호 핏</Text>
              </View>
            </View>
          </View>
          <View style={styles.avatarStage}>
            <View style={[styles.shoulderLine, { width: Math.max(78, toNumber(measurements.shoulder) * 2.35) }]} />
            <View style={[styles.torso, { width: Math.max(74, toNumber(measurements.chest) * 0.88) }]}>
              <View style={[styles.waistLine, { width: Math.max(52, toNumber(measurements.waist) * 0.82) }]} />
            </View>
            <View style={[styles.hipLine, { width: Math.max(76, toNumber(measurements.hip) * 0.83) }]} />
            <View style={styles.legs}>
              <View style={styles.leg} />
              <View style={styles.leg} />
            </View>
          </View>
        </View>

        <View style={styles.segment}>
          {bodyTypes.map((item) => (
            <Pressable
              key={item}
              onPress={() => setBodyType(item)}
              style={[styles.segmentButton, bodyType === item && styles.segmentButtonActive]}
            >
              <Text style={[styles.segmentText, bodyType === item && styles.segmentTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>상세 체형 입력</Text>
          <Text style={styles.sectionHint}>8개 치수</Text>
        </View>

        <View style={styles.measureGrid}>
          {fields.map((field) => (
            <View key={field.key} style={styles.inputCell}>
              <Text style={styles.inputLabel}>{field.label}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  keyboardType="decimal-pad"
                  value={measurements[field.key]}
                  onChangeText={(value) => updateMeasurement(field.key, value)}
                  style={styles.input}
                  maxLength={5}
                  selectionColor="#119C83"
                />
                <Text style={styles.unit}>{field.unit}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>선호 핏</Text>
          <Text style={styles.sectionHint}>추천 사이즈 반영</Text>
        </View>
        <View style={styles.preferenceRow}>
          {preferences.map((item) => (
            <Pressable
              key={item}
              onPress={() => setPreference(item)}
              style={[styles.preferenceButton, preference === item && styles.preferenceButtonActive]}
            >
              <Text style={[styles.preferenceText, preference === item && styles.preferenceTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>브랜드 아이템</Text>
          <Text style={styles.sectionHint}>탭해서 피팅</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productList}>
          {garments.map((garment) => {
            const isSelected = garment.id === selectedId;
            return (
              <Pressable
                key={garment.id}
                onPress={() => setSelectedId(garment.id)}
                style={[styles.productCard, isSelected && styles.productCardActive]}
              >
                <View style={[styles.productVisual, { backgroundColor: garment.imageTone }]}>
                  <View style={[styles.hanger, { backgroundColor: garment.accent }]} />
                  <View style={[styles.garmentShape, { backgroundColor: garment.color }]} />
                </View>
                <Text style={styles.brand}>{garment.brand}</Text>
                <Text style={styles.productName} numberOfLines={2}>
                  {garment.name}
                </Text>
                <Text style={styles.price}>{garment.price}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.fitPanel}>
          <View style={styles.fitHeader}>
            <View>
              <Text style={styles.fitLabel}>AI Fit preview</Text>
              <Text style={styles.fitTitle}>{selected.name}</Text>
            </View>
            <View style={styles.recommendBadge}>
              <Text style={styles.recommendLabel}>추천</Text>
              <Text style={styles.recommendSize}>{recommendation.label}</Text>
            </View>
          </View>

          <View style={styles.confidenceTrack}>
            <View style={[styles.confidenceFill, { width: `${recommendation.score}%` }]} />
          </View>
          <Text style={styles.confidenceText}>예상 만족도 {recommendation.score}%</Text>

          <View style={styles.fitRows}>
            {[
              { label: '가슴', value: chestEase },
              { label: '어깨', value: shoulderEase },
              { label: '허리', value: waistEase },
              { label: '엉덩이', value: hipEase },
            ]
              .filter((row) => row.value !== undefined)
              .map((row) => {
                const status = fitStatus(row.value ?? 0);
                return (
                  <View key={row.label} style={styles.fitRow}>
                    <Text style={styles.fitPart}>{row.label}</Text>
                    <View style={styles.fitMeter}>
                      <View
                        style={[
                          styles.fitDot,
                          {
                            backgroundColor: status.color,
                            left: `${Math.min(88, Math.max(6, ((row.value ?? 0) + 8) * 5))}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.fitState, { color: status.color }]}>{status.label}</Text>
                  </View>
                );
              })}
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>♡ 저장</Text>
            </Pressable>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>피팅룸에서 보기</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8F3',
  },
  screen: {
    paddingHorizontal: 18,
    paddingBottom: 34,
    paddingTop: Platform.OS === 'android' ? 44 : 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  kicker: {
    color: '#119C83',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 4,
  },
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  scorePill: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  scoreIcon: {
    color: '#69D2C8',
    fontSize: 15,
    fontWeight: '900',
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  hero: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E9DF',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 218,
    overflow: 'hidden',
  },
  heroCopy: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 18,
  },
  heroLabel: {
    color: '#F45D48',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#111827',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 31,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  metaItem: {
    backgroundColor: '#F7F8F3',
    borderRadius: 8,
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  metaValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  metaLabel: {
    color: '#72766D',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  avatarStage: {
    alignItems: 'center',
    backgroundColor: '#E9F8F6',
    justifyContent: 'center',
    paddingHorizontal: 14,
    width: 138,
  },
  shoulderLine: {
    backgroundColor: '#111827',
    borderRadius: 999,
    height: 12,
    marginBottom: 8,
  },
  torso: {
    alignItems: 'center',
    backgroundColor: '#69D2C8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: 86,
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  waistLine: {
    backgroundColor: '#119C83',
    borderRadius: 999,
    height: 11,
  },
  hipLine: {
    backgroundColor: '#FFB84D',
    borderRadius: 999,
    height: 15,
    marginTop: -2,
  },
  legs: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 7,
  },
  leg: {
    backgroundColor: '#111827',
    borderRadius: 999,
    height: 50,
    width: 18,
  },
  segment: {
    backgroundColor: '#ECEFE7',
    borderRadius: 8,
    flexDirection: 'row',
    marginTop: 16,
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  segmentButtonActive: {
    backgroundColor: '#111827',
  },
  segmentText: {
    color: '#60665D',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 24,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0,
  },
  sectionHint: {
    color: '#72766D',
    fontSize: 12,
    fontWeight: '800',
  },
  measureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inputCell: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E9DF',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    width: '48.5%',
  },
  inputLabel: {
    color: '#72766D',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  input: {
    color: '#111827',
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    padding: 0,
  },
  unit: {
    color: '#119C83',
    fontSize: 12,
    fontWeight: '900',
  },
  preferenceRow: {
    flexDirection: 'row',
    gap: 9,
  },
  preferenceButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E9DF',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  preferenceButtonActive: {
    backgroundColor: '#119C83',
    borderColor: '#119C83',
  },
  preferenceText: {
    color: '#60665D',
    fontSize: 13,
    fontWeight: '900',
  },
  preferenceTextActive: {
    color: '#FFFFFF',
  },
  productList: {
    gap: 12,
    paddingRight: 18,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E9DF',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    width: 156,
  },
  productCardActive: {
    borderColor: '#111827',
    borderWidth: 2,
    padding: 9,
  },
  productVisual: {
    alignItems: 'center',
    borderRadius: 7,
    height: 118,
    justifyContent: 'center',
    marginBottom: 10,
  },
  hanger: {
    borderRadius: 999,
    height: 8,
    marginBottom: -2,
    width: 54,
  },
  garmentShape: {
    borderRadius: 8,
    height: 74,
    width: 82,
  },
  brand: {
    color: '#119C83',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 3,
  },
  productName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
    minHeight: 38,
  },
  price: {
    color: '#72766D',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  fitPanel: {
    backgroundColor: '#111827',
    borderRadius: 8,
    marginTop: 22,
    padding: 16,
  },
  fitHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  fitLabel: {
    color: '#69D2C8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  fitTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 28,
    maxWidth: 210,
  },
  recommendBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minWidth: 66,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  recommendLabel: {
    color: '#72766D',
    fontSize: 11,
    fontWeight: '800',
  },
  recommendSize: {
    color: '#111827',
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 28,
  },
  confidenceTrack: {
    backgroundColor: '#2E3747',
    borderRadius: 999,
    height: 10,
    marginTop: 20,
    overflow: 'hidden',
  },
  confidenceFill: {
    backgroundColor: '#FFB84D',
    borderRadius: 999,
    height: '100%',
  },
  confidenceText: {
    color: '#DCE2EA',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  fitRows: {
    gap: 12,
    marginTop: 18,
  },
  fitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  fitPart: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    width: 44,
  },
  fitMeter: {
    backgroundColor: '#2E3747',
    borderRadius: 999,
    flex: 1,
    height: 8,
    position: 'relative',
  },
  fitDot: {
    borderColor: '#111827',
    borderRadius: 999,
    borderWidth: 2,
    height: 18,
    position: 'absolute',
    top: -5,
    width: 18,
  },
  fitState: {
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
    width: 40,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#465265',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 15,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#69D2C8',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
});
