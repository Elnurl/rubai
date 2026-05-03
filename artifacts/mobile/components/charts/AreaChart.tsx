import React, { useId } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

type Props = {
  data: number[];
  labels?: string[];
  height?: number;
  strokeWidth?: number;
  showDots?: boolean;
  highlightLastDot?: boolean;
};

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    d += ` C${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

export function AreaChart({
  data,
  labels,
  height = 120,
  strokeWidth = 2.5,
  showDots = false,
  highlightLastDot = false,
}: Props) {
  const colors = useColors();
  const [width, setWidth] = React.useState(0);
  const reactId = useId();
  const gradId = `areaChartGrad-${reactId.replace(/:/g, "")}`;

  if (data.length === 0) {
    return <View style={{ height }} />;
  }

  const padX = 6;
  const padY = 10;
  const labelGap = labels && labels.length > 0 ? 18 : 0;
  const chartH = Math.max(0, height - labelGap);
  const innerW = Math.max(0, width - padX * 2);
  const innerH = Math.max(0, chartH - padY * 2);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = padX + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = padY + (1 - (v - min) / range) * innerH;
    return { x, y };
  });

  const linePath = smoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x},${chartH - padY / 2} L${points[0].x},${chartH - padY / 2} Z`
      : "";

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ width: "100%" }}
    >
      <Svg width={width} height={chartH}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.22} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {width > 0 && (
          <>
            <Path d={areaPath} fill={`url(#${gradId})`} />
            <Path
              d={linePath}
              stroke={colors.primary}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {showDots &&
              points.map((p, i) => (
                <Circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={i === points.length - 1 && highlightLastDot ? 4 : 2.5}
                  fill={colors.card}
                  stroke={colors.primary}
                  strokeWidth={2}
                />
              ))}
          </>
        )}
      </Svg>
      {labels && labels.length > 0 && width > 0 && (
        <View style={styles.labelRow}>
          {labels.map((l, i) => (
            <Text
              key={`${l}-${i}`}
              style={[
                styles.label,
                { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
              ]}
            >
              {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 4,
  },
  label: {
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
});
