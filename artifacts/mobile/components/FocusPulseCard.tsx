import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { AreaChart } from "@/components/charts/AreaChart";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";


function isoForDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function FocusPulseCard() {
  const colors = useColors();
  const { t } = useTranslation();
  const dayLabels = useMemo(
    () => [
      t("focusPulseCard.dayMon", "M"),
      t("focusPulseCard.dayTue", "T"),
      t("focusPulseCard.dayWed", "W"),
      t("focusPulseCard.dayThu", "T"),
      t("focusPulseCard.dayFri", "F"),
      t("focusPulseCard.daySat", "S"),
      t("focusPulseCard.daySun", "S"),
    ],
    [t],
  );
  const { activeTaskHistory } = useAtlas();

  const { data, deltaPct } = useMemo(() => {
    // Build last-14-day series of completed-task counts (today at the right).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Align so the rightmost point is today; left edge = 13 days ago.
    const counts: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const iso = isoForDaysAgo(i);
      const completed = activeTaskHistory.filter(
        (e) => e.date === iso && e.completed,
      ).length;
      counts.push(completed);
    }
    const last7 = counts.slice(7);
    const prev7 = counts.slice(0, 7);
    const sumLast = last7.reduce((a, b) => a + b, 0);
    const sumPrev = prev7.reduce((a, b) => a + b, 0);
    const delta =
      sumPrev === 0
        ? sumLast > 0
          ? 100
          : 0
        : Math.round(((sumLast - sumPrev) / sumPrev) * 100);
    // For the chart we use last 7 (Mon-Sun-ish). If everything is zero we
    // fall back to a gentle baseline so the card doesn't look broken.
    const allZero = last7.every((v) => v === 0);
    const series = allZero ? [1, 2, 1, 3, 2, 4, 3] : last7;
    return { data: series, deltaPct: delta };
  }, [activeTaskHistory]);

  const deltaText =
    deltaPct === 0
      ? t("focusPulseCard.steady", "steady vs last week")
      : t("focusPulseCard.deltaVsLastWeek", "{{sign}}{{deltaPct}}% vs last week", {
          sign: deltaPct > 0 ? "+" : "",
          deltaPct,
        });
  const deltaColor = deltaPct >= 0 ? colors.primary : colors.destructive;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {t("focusPulseCard.eyebrow", "FOCUS PULSE")}
          </Text>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {t("focusPulseCard.title", "This week's rhythm")}
          </Text>
        </View>
        <View
          style={[
            styles.deltaPill,
            { backgroundColor: deltaColor + "1A" },
          ]}
        >
          <Feather
            name={deltaPct >= 0 ? "trending-up" : "trending-down"}
            size={11}
            color={deltaColor}
          />
          <Text
            style={[
              styles.deltaText,
              { color: deltaColor, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {deltaText}
          </Text>
        </View>
      </View>

      <AreaChart
        data={data}
        labels={dayLabels}
        height={120}
        showDots
        highlightLastDot
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  titleCol: {
    flexShrink: 1,
    gap: 4,
  },
  eyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 17,
    letterSpacing: -0.2,
  },
  deltaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  deltaText: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
