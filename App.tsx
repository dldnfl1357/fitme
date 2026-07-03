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
import BodyModel3D from './BodyModel3D';

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

type MeasurementKey = keyof Measurements;

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
  shoulder: '',
  chest: '',
  waist: '',
  hip: '',
  inseam: '',
  arm: '',
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

const fields: {
  key: MeasurementKey;
  label: string;
  unit: string;
  required?: boolean;
  guide: string;
}[] = [
  {
    key: 'height',
    label: '키',
    unit: 'cm',
    required: true,
    guide: '신발을 벗고 벽에 등을 붙인 상태에서 정수리부터 바닥까지 잽니다.',
  },
  {
    key: 'weight',
    label: '몸무게',
    unit: 'kg',
    required: true,
    guide: '가벼운 옷차림으로 체중계에 올라 현재 몸무게를 입력합니다.',
  },
  {
    key: 'shoulder',
    label: '어깨',
    unit: 'cm',
    guide: '왼쪽 어깨 끝 뼈부터 오른쪽 어깨 끝 뼈까지 등을 따라 수평으로 잽니다.',
  },
  {
    key: 'chest',
    label: '가슴',
    unit: 'cm',
    guide: '겨드랑이 아래를 지나 가슴의 가장 넓은 부분을 한 바퀴 둘러 잽니다.',
  },
  {
    key: 'waist',
    label: '허리',
    unit: 'cm',
    guide: '허리에서 가장 잘록한 지점을 숨을 편하게 쉰 상태로 한 바퀴 잽니다.',
  },
  {
    key: 'hip',
    label: '엉덩이',
    unit: 'cm',
    guide: '엉덩이에서 가장 넓게 튀어나온 지점을 수평으로 한 바퀴 잽니다.',
  },
  {
    key: 'inseam',
    label: '인심',
    unit: 'cm',
    guide: '다리 안쪽 시작점부터 발목 복숭아뼈 아래까지 안쪽 라인을 따라 잽니다.',
  },
  {
    key: 'arm',
    label: '팔길이',
    unit: 'cm',
    guide: '어깨 끝에서 팔꿈치를 지나 손목뼈까지 팔 바깥 라인을 따라 잽니다.',
  },
];

const bodyTypes = ['슬림', '균형', '하체 발달', '상체 발달'];
const preferences = ['타이트', '정핏', '여유', '오버핏'];
const optionalMeasurementKeys: MeasurementKey[] = ['shoulder', 'chest', 'waist', 'hip', 'inseam', 'arm'];

const toNumber = (value: string) => Number(value.replace(/[^0-9.]/g, '')) || 0;

function estimateMeasurements(measurements: Measurements, bodyType: string): Measurements {
  const height = toNumber(measurements.height) || 168;
  const weight = toNumber(measurements.weight) || Math.round((height / 100) ** 2 * 21);
  const bodyAdjustments = {
    shoulder: bodyType === '상체 발달' ? 2 : bodyType === '하체 발달' ? -1 : bodyType === '슬림' ? -1 : 0,
    chest: bodyType === '상체 발달' ? 5 : bodyType === '슬림' ? -3 : 0,
    waist: bodyType === '슬림' ? -4 : bodyType === '상체 발달' ? 2 : 0,
    hip: bodyType === '하체 발달' ? 5 : bodyType === '슬림' ? -3 : 0,
  };

  const estimated = {
    height,
    weight,
    shoulder: height * 0.225 + bodyAdjustments.shoulder,
    chest: height * 0.5 + weight * 0.05 + bodyAdjustments.chest,
    waist: height * 0.36 + weight * 0.16 + bodyAdjustments.waist,
    hip: height * 0.49 + weight * 0.2 + bodyAdjustments.hip,
    inseam: height * 0.44,
    arm: height * 0.34,
  };

  return {
    height: String(Math.round(estimated.height)),
    weight: String(Math.round(estimated.weight)),
    shoulder: String(Math.round(estimated.shoulder)),
    chest: String(Math.round(estimated.chest)),
    waist: String(Math.round(estimated.waist)),
    hip: String(Math.round(estimated.hip)),
    inseam: String(Math.round(estimated.inseam)),
    arm: String(Math.round(estimated.arm)),
  };
}

function getEffectiveMeasurements(measurements: Measurements, bodyType: string): Measurements {
  const estimates = estimateMeasurements(measurements, bodyType);

  return fields.reduce((profile, field) => {
    const entered = toNumber(measurements[field.key]);
    return {
      ...profile,
      [field.key]: entered > 0 ? measurements[field.key] : estimates[field.key],
    };
  }, {} as Measurements);
}

function isEstimated(key: MeasurementKey, measurements: Measurements) {
  return optionalMeasurementKeys.includes(key) && toNumber(measurements[key]) === 0;
}

function getFitScore(effectiveMeasurements: Measurements, garment: Garment, preference: string) {
  const chest = toNumber(effectiveMeasurements.chest);
  const shoulder = toNumber(effectiveMeasurements.shoulder);
  const waist = toNumber(effectiveMeasurements.waist);
  const hip = toNumber(effectiveMeasurements.hip);
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
  const [activeGuideKey, setActiveGuideKey] = useState<MeasurementKey>('shoulder');

  const selected = garments.find((garment) => garment.id === selectedId) ?? garments[0];
  const effectiveMeasurements = useMemo(
    () => getEffectiveMeasurements(measurements, bodyType),
    [measurements, bodyType],
  );
  const recommendation = useMemo(
    () => getFitScore(effectiveMeasurements, selected, preference),
    [effectiveMeasurements, selected, preference],
  );

  const chestEase = recommendation.chest ? recommendation.chest - toNumber(effectiveMeasurements.chest) : undefined;
  const waistEase = recommendation.waist ? recommendation.waist - toNumber(effectiveMeasurements.waist) : undefined;
  const hipEase = recommendation.hip ? recommendation.hip - toNumber(effectiveMeasurements.hip) : undefined;
  const shoulderEase = recommendation.shoulder
    ? recommendation.shoulder - toNumber(effectiveMeasurements.shoulder)
    : undefined;

  const measuredOptionalCount = optionalMeasurementKeys.filter((key) => toNumber(measurements[key]) > 0).length;
  const activeGuide = fields.find((field) => field.key === activeGuideKey) ?? fields[2];

  const updateMeasurement = (key: MeasurementKey, value: string) => {
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
            <Text style={styles.scoreText}>실측 {measuredOptionalCount}/6</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.avatarStage}>
            <BodyModel3D
              measurements={effectiveMeasurements}
              garmentColor={selected.color}
              garmentCategory={selected.category}
            />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroLabel}>3D body profile</Text>
            <Text style={styles.heroTitle}>입력한 치수로 실제 체형 모델을 렌더링합니다.</Text>
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
          <Text style={styles.sectionHint}>선택 치수는 자동 추정</Text>
        </View>

        <View style={styles.measureGrid}>
          {fields.map((field) => {
            const estimated = isEstimated(field.key, measurements);
            return (
              <Pressable
                key={field.key}
                onPress={() => setActiveGuideKey(field.key)}
                style={[styles.inputCell, activeGuideKey === field.key && styles.inputCellActive]}
              >
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>{field.label}</Text>
                  <Text style={[styles.inputBadge, estimated && styles.inputBadgeEstimated]}>
                    {field.required ? '필수' : estimated ? '추정' : '실측'}
                  </Text>
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    keyboardType="decimal-pad"
                    value={measurements[field.key]}
                    onChangeText={(value) => updateMeasurement(field.key, value)}
                    onFocus={() => setActiveGuideKey(field.key)}
                    style={styles.input}
                    placeholder={estimated ? effectiveMeasurements[field.key] : ''}
                    placeholderTextColor="#A7ADA3"
                    maxLength={5}
                    selectionColor="#119C83"
                  />
                  <Text style={styles.unit}>{field.unit}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.guidePanel}>
          <View style={styles.guideHeader}>
            <Text style={styles.guideTitle}>{activeGuide.label} 재는 법</Text>
            {!activeGuide.required && <Text style={styles.guideTag}>비워두면 추정</Text>}
          </View>
          <Text style={styles.guideText}>{activeGuide.guide}</Text>
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
          {measuredOptionalCount < optionalMeasurementKeys.length && (
            <Text style={styles.estimateNote}>* 표시된 부위는 키, 몸무게, 체형을 바탕으로 임시 추정했습니다.</Text>
          )}

          <View style={styles.fitRows}>
            {[
              { label: '가슴', value: chestEase, estimated: isEstimated('chest', measurements) },
              { label: '어깨', value: shoulderEase, estimated: isEstimated('shoulder', measurements) },
              { label: '허리', value: waistEase, estimated: isEstimated('waist', measurements) },
              { label: '엉덩이', value: hipEase, estimated: isEstimated('hip', measurements) },
            ]
              .filter((row) => row.value !== undefined)
              .map((row) => {
                const status = fitStatus(row.value ?? 0);
                return (
                  <View key={row.label} style={styles.fitRow}>
                    <Text style={styles.fitPart}>{row.estimated ? `${row.label}*` : row.label}</Text>
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
    backgroundColor: '#E9F8F6',
    borderRadius: 8,
    minHeight: 602,
    overflow: 'hidden',
  },
  heroCopy: {
    justifyContent: 'space-between',
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 10,
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
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 29,
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
    minHeight: 420,
    width: '100%',
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
  inputCellActive: {
    borderColor: '#119C83',
    borderWidth: 2,
    padding: 11,
  },
  inputLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inputLabel: {
    color: '#72766D',
    fontSize: 12,
    fontWeight: '800',
  },
  inputBadge: {
    backgroundColor: '#EEF1EA',
    borderRadius: 999,
    color: '#60665D',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  inputBadgeEstimated: {
    backgroundColor: '#FFF1D8',
    color: '#A76700',
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
  guidePanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE3D7',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 14,
  },
  guideHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  guideTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  guideTag: {
    color: '#119C83',
    fontSize: 11,
    fontWeight: '900',
  },
  guideText: {
    color: '#60665D',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
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
  estimateNote: {
    color: '#AAB4C2',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 7,
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
