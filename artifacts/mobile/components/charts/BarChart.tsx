import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

type Props = {
  data: number[];
  height?: number;
  startLabel?: string;
  endLabel?: string;
  showIndex?: boolean;
};

export function BarChart({
  data,
  height = 120,
  startLabel,
  endLabel,
  showIndex = true,
}: Props) {
  const colors = useColors();
  const [width, setWidth] = React.useState(0);

  if (data.length === 0) {
    return <View style={{ height }} />;
  }

  const indexRow = showIndex ? 14 : 0;
  const labelRow = startLabel || endLabel ? 16 : 0;
  const chartH = Math.max(0, height - indexRow - labelRow);
  const padX = 2;
  const innerW = Math.max(0, width - padX * 2);
  const slot = data.length > 0 ? innerW / data.length : 0;
  const barW = Math.max(4, slot * 0.62);

  const max = Math.max(...data, 1);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ width: "100%" }}
    >
      <Svg width={width} height={chartH}>
        {width > 0 &&
          data.map((v, i) => {
            const h = Math.max(2, (v / max) * (chartH - 4));
            const x = padX + slot * i + (slot - barW) / 2;
            const y = chartH - h;
            return (
              <Rect
                key={i}
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={3}
                ry={3}
                fill={colors.primary}
                opacity={0.85}
              />
            );
          })}
      </Svg>
      {showIndex && width > 0 && (
        <View style={[styles.indexRow, { width }]}>
          {data.map((_, i) => (
            <Text
              key={i}
              style={[
                styles.indexText,
                {
                  width: slot,
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {i + 1}
            </Text>
          ))}
        </View>
      )}
      {(startLabel || endLabel) && (
        <View style={styles.bottomLabelRow}>
          <Text
            style={[
              styles.bottomLabel,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {startLabel ?? ""}
          </Text>
          <Text
            style={[
              styles.bottomLabel,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {endLabel ?? ""}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  indexRow: {
    flexDirection: "row",
    marginTop: 2,
  },
  indexText: {
    fontSize: 9,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  bottomLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  bottomLabel: {
    fontSize: 11,
  },
});
