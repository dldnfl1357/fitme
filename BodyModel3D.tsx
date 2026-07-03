import { StyleSheet, Text, View } from 'react-native';

export type BodyModelMeasurements = {
  height: string;
  shoulder: string;
  chest: string;
  waist: string;
  hip: string;
  inseam: string;
  arm: string;
};

type BodyModel3DProps = {
  measurements: BodyModelMeasurements;
  garmentColor: string;
  garmentCategory: 'Top' | 'Bottom' | 'Outer';
};

const toNumber = (value: string) => Number(value.replace(/[^0-9.]/g, '')) || 0;

export default function BodyModel3D({ measurements, garmentColor }: BodyModel3DProps) {
  const shoulder = Math.max(84, toNumber(measurements.shoulder) * 2.2);
  const chest = Math.max(76, toNumber(measurements.chest) * 0.86);
  const waist = Math.max(54, toNumber(measurements.waist) * 0.78);
  const hip = Math.max(78, toNumber(measurements.hip) * 0.82);

  return (
    <View style={styles.stage}>
      <View style={[styles.shoulder, { width: shoulder }]} />
      <View style={[styles.torso, { width: chest, backgroundColor: garmentColor }]}>
        <View style={[styles.waist, { width: waist }]} />
      </View>
      <View style={[styles.hip, { width: hip }]} />
      <View style={styles.legs}>
        <View style={styles.leg} />
        <View style={styles.leg} />
      </View>
      <Text style={styles.caption}>3D body model</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 420,
  },
  shoulder: {
    backgroundColor: '#111827',
    borderRadius: 999,
    height: 12,
    marginBottom: 8,
  },
  torso: {
    alignItems: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: 86,
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  waist: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
    height: 11,
  },
  hip: {
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
  caption: {
    color: '#119C83',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 10,
    textTransform: 'uppercase',
  },
});
