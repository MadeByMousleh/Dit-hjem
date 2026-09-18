import { Feather } from "@expo/vector-icons";
import { Pressable, Text, TextInput, View } from "react-native";
import { formatPrice } from "../utils/formatting";

export function Stepper({ label, value, onChange, min, max, step = 10, suffix = "%", digits = 0, styles, colors }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number; suffix?: string; digits?: number; styles: Record<string, any>; colors: { ink: string; muted: string; white: string; line: string } }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable accessibilityLabel={`Sænk ${label}`} disabled={value <= min} onPress={() => onChange(Math.max(min, value - step))} style={styles.stepperButton}>
          <Feather name="minus" size={15} color={colors.ink} />
        </Pressable>
        <Text style={styles.stepperValue}>{formatPrice(value, digits)}{suffix}</Text>
        <Pressable accessibilityLabel={`Hæv ${label}`} disabled={value >= max} onPress={() => onChange(Math.min(max, value + step))} style={styles.stepperButton}>
          <Feather name="plus" size={15} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

export function NumericField({ label, value, suffix, onChange, styles, colors }: { label: string; value: number; suffix: string; onChange: (value: number) => void; styles: Record<string, any>; colors: { muted: string; ink: string } }) {
  return (
    <View style={styles.numericField}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.numericInputWrap}>
        <TextInput
          accessibilityLabel={label}
          inputMode="decimal"
          selectTextOnFocus
          value={formatPrice(value, Number.isInteger(value) ? 0 : 1)}
          onChangeText={(text) => {
            const parsed = Number(text.replace(",", "."));
            if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
          }}
          style={styles.numericInput}
        />
        <Text style={styles.numericSuffix}>{suffix}</Text>
      </View>
    </View>
  );
}
