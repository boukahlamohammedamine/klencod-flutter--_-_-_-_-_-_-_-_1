import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Network from "expo-network";
import Svg, { Circle } from "react-native-svg";
import {
  cancelWorkoutReminder,
  scheduleWorkoutReminder,
} from "@/lib/workout/notifications";
import { loadWorkoutData, saveWorkoutData } from "@/lib/workout/storage";
import {
  seedData,
  type Exercise,
  type WorkoutData,
  type WorkoutLog,
  type WorkoutPlan,
} from "@/lib/workout/model";
type Tab = "اليوم" | "خططي" | "التقدم" | "الإعدادات";
const C = {
  bg: "#F5F3EA",
  paper: "#FFFEFA",
  ink: "#20231F",
  muted: "#777B70",
  line: "#E5E3D8",
  lime: "#C7F36B",
  green: "#63824A",
  red: "#B3483B",
};
const fa = (n: number) =>
  new Intl.NumberFormat("ar", { maximumFractionDigits: 0 }).format(n);
const durationFor = (p: WorkoutPlan) =>
  p.exercises.reduce(
    (s, e) => s + (e.durationSeconds + e.restSeconds) * e.sets,
    0,
  );
export default function HomeScreen() {
  const [data, setData] = useState<WorkoutData>(seedData()),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState<Tab>("اليوم"),
    [query, setQuery] = useState(""),
    [historyQuery, setHistoryQuery] = useState(""),
    [historyRange, setHistoryRange] = useState("week"),
    [modal, setModal] = useState<"onboarding" | "plan" | "timer" | null>(null),
    [editing, setEditing] = useState<WorkoutPlan | null>(null),
    [draftTitle, setDraftTitle] = useState(""),
    [draftExercises, setDraftExercises] = useState<Exercise[]>([]),
    [filter, setFilter] = useState("الكل"),
    [offline, setOffline] = useState(false),
    [recovery, setRecovery] = useState(false),
    [toast, setToast] = useState(""),
    [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null),
    [exerciseIndex, setExerciseIndex] = useState(0),
    [setIndex, setSetIndex] = useState(1),
    [resting, setResting] = useState(false),
    [seconds, setSeconds] = useState(0),
    [paused, setPaused] = useState(false),
    [deadline, setDeadline] = useState<number | null>(null),
    [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null),
    [completedVolume, setCompletedVolume] = useState(0);
  useEffect(() => {
    let live = true;
    loadWorkoutData()
      .then(({ data: d, recovered }) => {
        if (!live) return;
        setData(d);
        setRecovery(recovered);
        setReady(true);
        if (!d.preferences.onboardingDone) setModal("onboarding");
        setOffline(
          typeof navigator !== "undefined" && "onLine" in navigator
            ? !navigator.onLine
            : false,
        );
      })
      .catch(() => {
        if (live) {
          setData(seedData());
          setRecovery(true);
          setReady(true);
        }
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (ready)
      saveWorkoutData(data).catch(() => setToast("تعذر الحفظ — أعد المحاولة"));
  }, [data, ready]);
  useEffect(() => {
    const on = () => {
      setOffline(false);
      setToast("عاد الاتصال — بياناتك المحلية ما تزال محفوظة");
    };
    const off = () => {
      setOffline(true);
      setToast("أنت دون اتصال — تمارينك وبياناتك متاحة");
    };
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    }
    Network.getNetworkStateAsync()
      .then((state) => setOffline(state.isConnected === false))
      .catch(() => {});
    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected === false) off();
      else if (state.isConnected === true) on();
    });
    return () => subscription.remove();
  }, []);
  const updatePrefs = (patch: Partial<WorkoutData["preferences"]>) =>
    setData((d) => ({ ...d, preferences: { ...d.preferences, ...patch } }));
  const todayPlan = data.plans[0],
    totalMinutes = data.logs.reduce((a, l) => a + l.durationMinutes, 0),
    weekly = data.logs.filter(
      (l) => Date.now() - new Date(l.date).getTime() < 7 * 86400000,
    ).length;
  const filteredPlans = useMemo(
    () =>
      data.plans
        .filter(
          (p) =>
            p.title.includes(query.trim()) || p.focus.includes(query.trim()),
        )
        .filter((p) => filter === "الكل" || p.focus.includes(filter)),
    [data.plans, query, filter],
  );
  const recentDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6 + i);
    return date;
  });
  const trendChart = (
    title: string,
    field: "durationMinutes" | "volume",
    unit: string,
  ) => {
    const values = recentDates.map((day) =>
      data.logs
        .filter(
          (log) => new Date(log.date).toDateString() === day.toDateString(),
        )
        .reduce((sum, log) => sum + log[field], 0),
    );
    const peak = Math.max(1, ...values);
    return (
      <View style={s.progress}>
        <View style={s.progressHead}>
          <View>
            <Text style={s.chartTitle}>{title}</Text>
            <Text style={s.progressNum}>
              {fa(values.reduce((sum, value) => sum + value, 0))}
              <Text style={s.chartHint}> {unit} · ٧ أيام</Text>
            </Text>
          </View>
        </View>
        <View style={s.bars}>
          {recentDates.map((day, i) => (
            <View key={`${field}-${day.toDateString()}`} style={s.barWrap}>
              <View style={s.track}>
                <View
                  style={[
                    s.fill,
                    {
                      height: values[i]
                        ? `${Math.max(8, (values[i] / peak) * 100)}%`
                        : "0%",
                    },
                  ]}
                />
              </View>
              <Text style={s.barLabel}>
                {new Intl.DateTimeFormat("ar", { weekday: "short" }).format(
                  day,
                )}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };
  const visibleLogs = data.logs
    .filter(
      (log) =>
        log.title.includes(historyQuery.trim()) ||
        new Intl.DateTimeFormat("ar", { day: "numeric", month: "short" })
          .format(new Date(log.date))
          .includes(historyQuery.trim()),
    )
    .filter(
      (log) =>
        historyRange === "all" ||
        Date.now() - new Date(log.date).getTime() < 7 * 86400000,
    );
  const msg = (v: string) => {
    setToast(v);
    setTimeout(() => setToast(""), 3300);
  };
  const startWorkout = (p: WorkoutPlan) => {
    if (data.preferences.haptics && Platform.OS !== "web")
      Haptics.selectionAsync().catch(() => {});
    setActivePlan(p);
    setExerciseIndex(0);
    setSetIndex(1);
    setResting(false);
    const firstDuration = Math.max(1, p.exercises[0]?.durationSeconds ?? 35);
    setSeconds(firstDuration);
    setDeadline(Date.now() + firstDuration * 1000);
    setSessionStartedAt(Date.now());
    setCompletedVolume(0);
    setPaused(false);
    setModal("timer");
  };
  const finish = () => {
    if (activePlan) {
      const log: WorkoutLog = {
        id: `log-${Date.now()}`,
        planId: activePlan.id,
        title: activePlan.title,
        date: new Date().toISOString(),
        durationMinutes: Math.max(
          1,
          Math.round((Date.now() - (sessionStartedAt ?? Date.now())) / 60000),
        ),
        volume: completedVolume,
      };
      setData((d) => ({ ...d, logs: [log, ...d.logs] }));
    }
    setActivePlan(null);
    setDeadline(null);
    setSessionStartedAt(null);
    setPaused(false);
    setModal(null);
    msg("أحسنت! أُضيف تمرينك إلى السجل");
  };
  const startPhase = (durationSeconds: number) => {
    const safeSeconds = Math.max(1, Math.round(durationSeconds));
    setSeconds(safeSeconds);
    setDeadline(Date.now() + safeSeconds * 1000);
  };
  const advanceAfterRest = () => {
    if (!activePlan) return;
    const exercise = activePlan.exercises[exerciseIndex];
    if (setIndex < exercise.sets) {
      setSetIndex((n) => n + 1);
      setResting(false);
      startPhase(exercise.durationSeconds);
    } else if (exerciseIndex < activePlan.exercises.length - 1) {
      const nextIndex = exerciseIndex + 1;
      setExerciseIndex(nextIndex);
      setSetIndex(1);
      setResting(false);
      startPhase(activePlan.exercises[nextIndex].durationSeconds);
    } else finish();
  };
  const transitionPhase = (completedWork: boolean) => {
    if (!activePlan) return;
    const exercise = activePlan.exercises[exerciseIndex];
    if (!resting) {
      if (completedWork) {
        setCompletedVolume((v) => v + exercise.reps * 10);
        if (data.preferences.haptics && Platform.OS !== "web")
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
      }
      setResting(true);
      if (exercise.restSeconds > 0) startPhase(exercise.restSeconds);
      else advanceAfterRest();
    } else advanceAfterRest();
  };
  const advance = () => (resting ? advanceAfterRest() : transitionPhase(false));
  const stopWorkout = () => {
    const confirmStop = () =>
      Alert.alert(
        "إنهاء الجلسة؟",
        "سيُحفظ الوقت والمجموعات المكتملة حتى الآن.",
        [
          { text: "متابعة", style: "cancel" },
          { text: "إنهاء وتسجيل", onPress: finish },
        ],
      );
    if (Platform.OS === "web") {
      if (
        window.confirm("إنهاء الجلسة الآن؟ سيتم حفظ الوقت والمجموعات المكتملة.")
      )
        finish();
    } else confirmStop();
  };
  useEffect(() => {
    if (!activePlan || paused || deadline === null) return;
    const id = setInterval(() => {
      const remaining = Math.ceil((deadline - Date.now()) / 1000);
      if (remaining <= 0) transitionPhase(!resting);
      else setSeconds(remaining);
    }, 250);
    return () => clearInterval(id);
  }, [activePlan, paused, deadline, resting, exerciseIndex, setIndex]);
  const openPlan = (p?: WorkoutPlan) => {
    setEditing(p ?? null);
    setDraftTitle(p?.title ?? "");
    setDraftExercises(
      p
        ? p.exercises.map((e) => ({ ...e }))
        : [
            {
              id: `e-${Date.now()}`,
              name: "قرفصاء",
              sets: 3,
              reps: 10,
              restSeconds: 60,
              durationSeconds: 35,
            },
          ],
    );
    setModal("plan");
  };
  const updateDraftExercise = (id: string, patch: Partial<Exercise>) =>
    setDraftExercises((items) =>
      items.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  const addDraftExercise = () =>
    setDraftExercises((items) =>
      items.length >= 12
        ? items
        : [
            ...items,
            {
              id: `e-${Date.now()}`,
              name: "تمرين جديد",
              sets: 3,
              reps: 10,
              restSeconds: 60,
              durationSeconds: 35,
            },
          ],
    );
  const savePlan = () => {
    const title = draftTitle.trim();
    if (!title || draftExercises.length === 0) return;
    const exercises = draftExercises.map((e) => ({
      ...e,
      name: e.name.trim() || "تمرين جديد",
      sets: Math.max(1, Number(e.sets) || 1),
      reps: Math.max(1, Number(e.reps) || 1),
      restSeconds: Math.max(0, Number(e.restSeconds) || 0),
    }));
    if (editing)
      setData((d) => ({
        ...d,
        plans: d.plans.map((p) =>
          p.id === editing.id ? { ...p, title, exercises } : p,
        ),
      }));
    else
      setData((d) => ({
        ...d,
        plans: [
          {
            id: `plan-${Date.now()}`,
            title,
            focus: "قوة · ٣٠ دقيقة",
            color: C.lime,
            exercises,
          },
          ...d.plans,
        ],
      }));
    setModal(null);
    setEditing(null);
    msg("حُفظت خطتك");
  };
  const clone = (p: WorkoutPlan) =>
    setData((d) => ({
      ...d,
      plans: [
        { ...p, id: `plan-${Date.now()}`, title: `${p.title} — نسخة` },
        ...d.plans,
      ],
    }));
  const remove = (p: WorkoutPlan) => {
    const go = () =>
      setData((d) => ({ ...d, plans: d.plans.filter((x) => x.id !== p.id) }));
    if (Platform.OS === "web") {
      if (window.confirm(`حذف خطة «${p.title}»؟`)) go();
    } else
      Alert.alert("حذف الخطة؟", `سيُحذف «${p.title}» من خططك.`, [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: go },
      ]);
  };
  const reminderLabel = (hour: number, minute: number) =>
    `${fa(hour % 12 || 12)}:${String(minute).padStart(2, "0")} ${hour < 12 ? "صباحًا" : "مساءً"}`;
  const reminders = async (on: boolean) => {
    if (!on) {
      updatePrefs({ reminders: false });
      await cancelWorkoutReminder();
      return;
    }
    updatePrefs({ reminders: false });
    const result = await scheduleWorkoutReminder(
      data.preferences.reminderHour,
      data.preferences.reminderMinute,
      data.preferences.sound,
    );
    if (result === "scheduled") {
      updatePrefs({ reminders: true });
      msg(
        `تم ضبط تذكيرك اليومي الساعة ${reminderLabel(data.preferences.reminderHour, data.preferences.reminderMinute)}`,
      );
    } else if (result === "denied")
      msg("لم يُمنح إذن الإشعارات. يمكنك تفعيله من إعدادات الجهاز.");
    else if (result === "unsupported")
      msg("التذكيرات متاحة على جهاز iOS أو Android.");
    else msg("تعذر إعداد التذكير الآن. حاول مجددًا.");
  };
  const changeSound = async (sound: boolean) => {
    updatePrefs({ sound });
    if (data.preferences.reminders) {
      const result = await scheduleWorkoutReminder(
        data.preferences.reminderHour,
        data.preferences.reminderMinute,
        sound,
      );
      if (result !== "scheduled") msg("تعذر تحديث صوت التذكير.");
    }
  };
  const changeReminderHour = async (delta: number) => {
    const reminderHour = (data.preferences.reminderHour + delta + 24) % 24;
    updatePrefs({ reminderHour });
    if (data.preferences.reminders) {
      const result = await scheduleWorkoutReminder(
        reminderHour,
        data.preferences.reminderMinute,
      );
      if (result !== "scheduled") {
        updatePrefs({ reminders: false });
        msg("تعذر تحديث التذكير. أعد تفعيله من إعدادات الجهاز.");
      } else
        msg(
          `موعد التذكير: ${reminderLabel(reminderHour, data.preferences.reminderMinute)}`,
        );
    }
  };
  if (!ready)
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color={C.green} size="large" />
          <Text style={s.muted}>نجهّز مساحتك…</Text>
        </View>
      </SafeAreaView>
    );
  const H = ({ children, style }: { children: any; style?: any }) => (
    <Text style={[s.heading, style]}>{children}</Text>
  );
  const Btn = ({
    title,
    onPress,
    primary = false,
    icon,
  }: {
    title: string;
    onPress: () => void;
    primary?: boolean;
    icon?: any;
  }) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[s.button, primary && s.primary]}
    >
      {icon && <Ion name={icon} size={18} color={C.ink} />}
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
  const card = (p: WorkoutPlan) => (
    <View key={p.id} style={s.planCard}>
      <View style={[s.accent, { backgroundColor: p.color }]} />
      <View style={s.planBody}>
        <Text style={s.planTitle}>{p.title}</Text>
        <Text style={s.muted}>
          {p.focus} · {fa(p.exercises.length)} تمارين
        </Text>
        <View style={s.actions}>
          <Btn
            title="ابدأ"
            primary
            icon="play"
            onPress={() => startWorkout(p)}
          />
          <Pressable
            accessibilityLabel={`تعديل ${p.title}`}
            onPress={() => openPlan(p)}
            style={s.iconBtn}
          >
            <Ion name="create-outline" size={20} color={C.ink} />
          </Pressable>
          <Pressable
            accessibilityLabel={`نسخ ${p.title}`}
            onPress={() => clone(p)}
            style={s.iconBtn}
          >
            <Ion name="copy-outline" size={19} color={C.ink} />
          </Pressable>
          <Pressable
            accessibilityLabel={`حذف ${p.title}`}
            onPress={() => remove(p)}
            style={s.iconBtn}
          >
            <Ion name="trash-outline" size={19} color={C.muted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
  const today = () => (
    <>
      <View style={s.top}>
        <View>
          <Text style={s.kicker}>
            {new Intl.DateTimeFormat("ar", { weekday: "long" }).format(
              new Date(),
            )}{" "}
            · يوم جديد
          </Text>
          <H style={s.title}>
            أهلًا{data.preferences.name ? `، ${data.preferences.name}` : " بك"}
          </H>
        </View>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {(data.preferences.name || "ن").slice(0, 1)}
          </Text>
        </View>
      </View>
      {recovery && (
        <Pressable
          onPress={() => {
            setRecovery(false);
            msg("استعدنا مساحة جديدة — أضف خططك من «خططي»");
          }}
          style={s.notice}
        >
          <Ion name="refresh-circle-outline" size={19} color={C.green} />
          <Text style={s.noticeText}>
            تعذر قراءة آخر نسخة. ابدأ من جديد أو أعد إضافة خططك.
          </Text>
        </Pressable>
      )}
      {offline && (
        <View style={s.notice}>
          <Ion name="cloud-offline-outline" size={16} color={C.ink} />
          <Text style={s.noticeText}>
            دون اتصال · بياناتك محفوظة على هذا الجهاز
          </Text>
        </View>
      )}
      <View style={s.week}>
        <View>
          <Text style={s.kicker}>هذا الأسبوع</Text>
          <Text style={s.weekBig}>
            {fa(weekly)} <Text style={s.weekUnit}>جلسات</Text>
          </Text>
        </View>
        <View style={s.divider} />
        <View>
          <Text style={s.kicker}>وقت الحركة</Text>
          <Text style={s.weekBig}>
            {fa(totalMinutes)} <Text style={s.weekUnit}>دقيقة</Text>
          </Text>
        </View>
        <Text style={s.streak}>✦ {fa(Math.min(weekly, 5))} أيام</Text>
      </View>
      <View style={s.section}>
        <H>تمرين اليوم</H>
        <Text style={s.caption}>خطوة صغيرة تكفي</Text>
      </View>
      {todayPlan ? (
        <View style={s.hero}>
          <View style={s.heroTop}>
            <Text style={s.tag}>جاهز لك</Text>
            <Ion name="flash" size={22} color={C.ink} />
          </View>
          <Text style={s.heroTitle}>{todayPlan.title}</Text>
          <Text style={s.heroSub}>
            {todayPlan.focus} · {fa(todayPlan.exercises.length)} تمارين
          </Text>
          <View style={s.heroBottom}>
            <View>
              <Text style={s.heroSub}>تقدير الجلسة</Text>
              <Text style={s.stat}>
                {fa(Math.round(durationFor(todayPlan) / 60))} دقيقة
              </Text>
            </View>
            <Pressable
              accessibilityLabel="ابدأ تمرين اليوم"
              onPress={() => startWorkout(todayPlan)}
              style={s.start}
            >
              <Ion name="arrow-back" size={22} color={C.ink} />
              <Text style={s.startLabel}>ابدأ</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={s.empty}>
          <Text style={s.planTitle}>لا توجد خطة بعد</Text>
          <Btn title="إنشاء خطة" primary onPress={() => openPlan()} />
        </View>
      )}
      <View style={s.section}>
        <H>خططك</H>
        <Pressable onPress={() => setTab("خططي")}>
          <Text style={s.link}>عرض الكل ←</Text>
        </Pressable>
      </View>
      {data.plans.slice(0, 2).map(card)}
      <View style={s.tip}>
        <Text style={s.planTitle}>تذكير لطيف</Text>
        <Text style={s.muted}>
          الاستمرارية أهم من الكمال. تمرينك ينتظرك متى ما كنت مستعدًا.
        </Text>
      </View>
    </>
  );
  const plans = () => (
    <>
      <View style={s.top}>
        <View>
          <Text style={s.kicker}>مساحتك، بطريقتك</Text>
          <H style={s.title}>خططي</H>
        </View>
        <Pressable
          style={s.add}
          onPress={() => openPlan()}
          accessibilityLabel="إنشاء خطة"
        >
          <Ion name="add" size={24} color={C.ink} />
        </Pressable>
      </View>
      <View style={s.search}>
        <Ion name="search-outline" size={19} color={C.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث عن خطة…"
          placeholderTextColor={C.muted}
          style={s.searchInput}
          accessibilityLabel="البحث في الخطط"
        />
        <Pressable onPress={() => setQuery("")} accessibilityLabel="مسح البحث">
          <Ion name="close-circle" size={17} color={C.muted} />
        </Pressable>
      </View>
      <View style={s.chips}>
        {["الكل", "قوة", "مرونة"].map((c) => (
          <Pressable
            key={c}
            onPress={() => setFilter(c)}
            style={[s.chip, filter === c && s.chipActive]}
          >
            <Text style={[s.chipText, filter === c && s.chipTextActive]}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={s.section}>
        <H>{fa(filteredPlans.length)} خطط</H>
        <Text style={s.caption}>تنظيمك يصنع الفرق</Text>
      </View>
      {filteredPlans.map(card)}
      {filteredPlans.length === 0 && (
        <View style={s.empty}>
          <Text style={s.planTitle}>ما لقينا نتيجة</Text>
          <Text style={s.muted}>جرّب كلمة ثانية أو أزل التصفية.</Text>
          <Btn
            title="إزالة البحث"
            onPress={() => {
              setQuery("");
              setFilter("الكل");
            }}
          />
        </View>
      )}
      <Btn title="خطة جديدة" primary icon="add" onPress={() => openPlan()} />
    </>
  );
  const progress = () => (
    <>
      <Text style={s.kicker}>كل خطوة تُحتسب</Text>
      <H style={s.title}>تقدّمك</H>
      <Text style={s.muted}>إنجازك خلال آخر ٧ أيام</Text>
      <View style={s.progress}>
        <View style={s.progressHead}>
          <View>
            <Text style={s.chartTitle}>جلسات مكتملة</Text>
            <Text style={s.progressNum}>
              {fa(weekly)}
              <Text style={s.chartHint}> / ٥</Text>
            </Text>
          </View>
          <Text style={s.progressBadge}>↗ على الطريق</Text>
        </View>
        <View style={s.bars}>
          {Array.from({ length: 7 }, (_, i) => {
            const day = recentDates[i];
            const key = day.toISOString().slice(0, 10);
            const count = data.logs.filter(
              (log) => new Date(log.date).toDateString() === day.toDateString(),
            ).length;
            return (
              <View key={key} style={s.barWrap}>
                <View style={s.track}>
                  <View
                    style={[
                      s.fill,
                      {
                        height: count ? `${Math.min(100, count * 52)}%` : "0%",
                      },
                    ]}
                  />
                </View>
                <Text style={s.barLabel}>
                  {new Intl.DateTimeFormat("ar", { weekday: "short" }).format(
                    day,
                  )}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={s.chartHint}>
          جلساتك اليومية · بيانات محفوظة على هذا الجهاز
        </Text>
      </View>
      {trendChart("مدة التدريب", "durationMinutes", "دقيقة")}
      {trendChart("حجم التدريب", "volume", "نقطة")}
      <View style={s.metrics}>
        <View style={s.metric}>
          <Text style={s.muted}>وقت التدريب</Text>
          <Text style={s.metricVal}>
            {fa(totalMinutes)} <Text style={s.metricUnit}>د</Text>
          </Text>
          <Text style={s.chartHint}>إجمالي الدقائق</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.muted}>حجم التدريب</Text>
          <Text style={s.metricVal}>
            {fa(data.logs.reduce((a, b) => a + b.volume, 0))}
          </Text>
          <Text style={s.chartHint}>نقطة تدريب تقريبية</Text>
        </View>
      </View>
      <View style={s.section}>
        <H>آخر الجلسات</H>
        <Text style={s.caption}>{fa(visibleLogs.length)} جلسات</Text>
      </View>
      <View style={s.search}>
        <Ion name="search-outline" size={18} color={C.muted} />
        <TextInput
          value={historyQuery}
          onChangeText={setHistoryQuery}
          placeholder="ابحث بالاسم أو التاريخ…"
          placeholderTextColor={C.muted}
          style={s.searchInput}
          accessibilityLabel="البحث في سجل التمارين"
        />
        <Pressable
          onPress={() => setHistoryQuery("")}
          accessibilityLabel="مسح البحث"
        >
          <Ion name="close-circle" size={17} color={C.muted} />
        </Pressable>
      </View>
      <View style={s.chips}>
        {[
          ["week", "هذا الأسبوع"],
          ["all", "كل الوقت"],
        ].map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setHistoryRange(value)}
            style={[s.chip, historyRange === value && s.chipActive]}
          >
            <Text
              style={[s.chipText, historyRange === value && s.chipTextActive]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {visibleLogs.length ? (
        visibleLogs.slice(0, 8).map((l) => (
          <View key={l.id} style={s.log}>
            <View style={s.logIcon}>
              <Ion name="checkmark" size={18} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.planTitle}>{l.title}</Text>
              <Text style={s.muted}>
                {new Intl.DateTimeFormat("ar", {
                  day: "numeric",
                  month: "short",
                }).format(new Date(l.date))}{" "}
                · {fa(l.durationMinutes)} دقيقة
              </Text>
            </View>
            <Text style={s.logVol}>{fa(l.volume)}</Text>
          </View>
        ))
      ) : (
        <View style={s.empty}>
          <Text style={s.planTitle}>سجلك يبدأ من هنا</Text>
          <Text style={s.muted}>أكمل تمرينًا وستظهر إحصاءاتك.</Text>
        </View>
      )}
    </>
  );
  const settings = () => (
    <>
      <Text style={s.kicker}>تفاصيل على مقاسك</Text>
      <H style={s.title}>الإعدادات</H>
      <View style={s.profile}>
        <View style={s.avatar}>
          <Ion name="person" size={20} color={C.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.planTitle}>
            {data.preferences.name || "متدرّب نبض"}
          </Text>
          <Text style={s.muted}>
            {data.preferences.goal} · {data.preferences.level}
          </Text>
        </View>
        <Pressable
          onPress={() => setModal("onboarding")}
          accessibilityLabel="تعديل الملف"
        >
          <Ion name="create-outline" size={20} color={C.muted} />
        </Pressable>
      </View>
      <View style={s.settings}>
        <Text style={s.group}>تفضيلات التدريب</Text>
        <View style={s.setting}>
          <View>
            <Text style={s.planTitle}>وحدات الوزن</Text>
            <Text style={s.muted}>اختر ما يناسبك</Text>
          </View>
          <Pressable
            onPress={() =>
              updatePrefs({
                units: data.preferences.units === "kg" ? "lb" : "kg",
              })
            }
            style={s.unit}
          >
            <Text style={s.unitTxt}>
              {data.preferences.units === "kg" ? "كجم" : "رطل"}
            </Text>
            <Ion name="swap-horizontal" size={16} color={C.ink} />
          </Pressable>
        </View>
        <View style={s.setting}>
          <View>
            <Text style={s.planTitle}>وقت التذكير</Text>
            <Text style={s.muted}>
              {reminderLabel(
                data.preferences.reminderHour,
                data.preferences.reminderMinute,
              )}
            </Text>
          </View>
          <View style={s.inline}>
            <Pressable
              onPress={() => changeReminderHour(-1)}
              accessibilityLabel="تقديم التذكير ساعة"
            >
              <Text style={s.counter}>−</Text>
            </Pressable>
            <Pressable
              onPress={() => changeReminderHour(1)}
              accessibilityLabel="تأخير التذكير ساعة"
            >
              <Text style={s.counter}>＋</Text>
            </Pressable>
          </View>
        </View>
        {[
          [
            "التذكير اليومي",
            `كل يوم عند ${reminderLabel(data.preferences.reminderHour, data.preferences.reminderMinute)}`,
            data.preferences.reminders,
            reminders,
          ],
          [
            "صوت التذكير",
            "صوت الإشعار اليومي",
            data.preferences.sound,
            changeSound,
          ],
          [
            "الاهتزاز",
            "استجابة لمسية عند التبديل",
            data.preferences.haptics,
            (v: boolean) => updatePrefs({ haptics: v }),
          ],
        ].map(([title, sub, value, change]: any) => (
          <View key={title} style={s.setting}>
            <View>
              <Text style={s.planTitle}>{title}</Text>
              <Text style={s.muted}>{sub}</Text>
            </View>
            <Switch
              value={value}
              onValueChange={change}
              trackColor={{ false: C.line, true: C.lime }}
              thumbColor={C.paper}
              accessibilityLabel={title}
            />
          </View>
        ))}
      </View>
      <View style={s.settings}>
        <Text style={s.group}>إمكانية الوصول والخصوصية</Text>
        <Text style={[s.muted, { marginVertical: 10 }]}>
          واجهة واضحة وأهداف لمس كبيرة وتسميات لقارئ الشاشة. بياناتك محفوظة
          محليًا، وتعمل دون اتصال.
        </Text>
        <Pressable
          onPress={() => {
            const reset = async () => {
              try {
                await AsyncStorage.removeItem("nabd.workout-data.v1");
                setData(seedData());
                msg("استُعيدت البيانات الافتراضية");
              } catch {
                msg("تعذر الاستعادة. أعد المحاولة لاحقًا.");
              }
            };
            if (Platform.OS === "web") {
              if (
                window.confirm(
                  "سيُحذف سجلّك وخططك الحالية وتُستعاد البيانات الافتراضية. هل تريد المتابعة؟",
                )
              )
                void reset();
            } else
              Alert.alert(
                "استعادة البيانات الافتراضية؟",
                "سيُحذف سجلّك وخططك الحالية من هذا الجهاز.",
                [
                  { text: "إلغاء", style: "cancel" },
                  { text: "استعادة", style: "destructive", onPress: reset },
                ],
              );
          }}
          style={s.reset}
        >
          <Ion name="refresh-outline" size={18} color={C.red} />
          <Text style={{ color: C.red, fontWeight: "700" }}>
            استعادة البيانات الافتراضية
          </Text>
        </Pressable>
      </View>
      <Text style={s.version}>نبض · الإصدار ١٫٠ · تقدّمك، بهدوء</Text>
    </>
  );
  const exercise = activePlan?.exercises[exerciseIndex];
  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={s.app}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {tab === "اليوم"
            ? today()
            : tab === "خططي"
              ? plans()
              : tab === "التقدم"
                ? progress()
                : settings()}
          <View style={{ height: 22 }} />
        </ScrollView>
        <View style={s.tabBar}>
          {(
            [
              ["اليوم", "sunny-outline"],
              ["خططي", "barbell-outline"],
              ["التقدم", "stats-chart-outline"],
              ["الإعدادات", "settings-outline"],
            ] as [Tab, string][]
          ).map(([name, icon]) => (
            <Pressable
              key={name}
              onPress={() => {
                setTab(name);
                setQuery("");
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === name }}
              style={s.tab}
            >
              <Ion
                name={icon as any}
                size={21}
                color={tab === name ? C.ink : C.muted}
              />
              <Text style={[s.tabLabel, tab === name && s.tabSelected]}>
                {name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {!!toast && (
        <Pressable onPress={() => setToast("")} style={s.toast}>
          <Ion
            name={
              offline ? "cloud-offline-outline" : "checkmark-circle-outline"
            }
            size={19}
            color={C.lime}
          />
          <Text style={s.toastText}>{toast}</Text>
          <Ion name="close" size={16} color="#D8D9D0" />
        </Pressable>
      )}
      <Modal
        visible={modal === "plan"}
        transparent
        animationType="slide"
        onRequestClose={() => setModal(null)}
      >
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.kicker}>
              {editing ? "خطتك، كما تحب" : "ابدأ بخطتك الأولى"}
            </Text>
            <H>{editing ? "تعديل الخطة" : "خطة جديدة"}</H>
            <Text style={s.label}>اسم الخطة</Text>
            <TextInput
              autoFocus
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="مثال: يوم الأرجل"
              placeholderTextColor={C.muted}
              style={s.input}
              accessibilityLabel="اسم الخطة"
            />
            <View style={s.exerciseList}>
              <ScrollView
                style={s.exerciseScroll}
                keyboardShouldPersistTaps="handled"
              >
                {draftExercises.map((exercise, index) => (
                  <View key={exercise.id} style={s.exerciseDraft}>
                    <View style={s.exerciseDraftHead}>
                      <Text style={s.group}>التمرين {fa(index + 1)}</Text>
                      {draftExercises.length > 1 && (
                        <Pressable
                          onPress={() =>
                            setDraftExercises((items) =>
                              items.filter((e) => e.id !== exercise.id),
                            )
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`حذف التمرين ${index + 1}`}
                        >
                          <Ion name="trash-outline" size={18} color={C.red} />
                        </Pressable>
                      )}
                    </View>
                    <TextInput
                      value={exercise.name}
                      onChangeText={(name) =>
                        updateDraftExercise(exercise.id, { name })
                      }
                      placeholder="اسم التمرين"
                      placeholderTextColor={C.muted}
                      style={s.input}
                      accessibilityLabel={`اسم التمرين ${index + 1}`}
                    />
                    <View style={s.fieldRow}>
                      <View style={s.fieldCell}>
                        <Text style={s.label}>المجموعات</Text>
                        <TextInput
                          value={String(exercise.sets)}
                          onChangeText={(v) =>
                            updateDraftExercise(exercise.id, {
                              sets: Number(v) || 1,
                            })
                          }
                          keyboardType="number-pad"
                          style={s.input}
                          accessibilityLabel={`مجموعات التمرين ${index + 1}`}
                        />
                      </View>
                      <View style={s.fieldCell}>
                        <Text style={s.label}>التكرارات</Text>
                        <TextInput
                          value={String(exercise.reps)}
                          onChangeText={(v) =>
                            updateDraftExercise(exercise.id, {
                              reps: Number(v) || 1,
                            })
                          }
                          keyboardType="number-pad"
                          style={s.input}
                          accessibilityLabel={`تكرارات التمرين ${index + 1}`}
                        />
                      </View>
                    </View>
                    <View style={s.fieldRow}>
                      <View style={s.fieldCell}>
                        <Text style={s.label}>العمل (ث)</Text>
                        <TextInput
                          value={String(exercise.durationSeconds)}
                          onChangeText={(v) =>
                            updateDraftExercise(exercise.id, {
                              durationSeconds: Number(v) || 1,
                            })
                          }
                          keyboardType="number-pad"
                          style={s.input}
                          accessibilityLabel={`مدة العمل بالثواني للتمرين ${index + 1}`}
                        />
                      </View>
                      <View style={s.fieldCell}>
                        <Text style={s.label}>الراحة (ث)</Text>
                        <TextInput
                          value={String(exercise.restSeconds)}
                          onChangeText={(v) =>
                            updateDraftExercise(exercise.id, {
                              restSeconds: Number(v) || 0,
                            })
                          }
                          keyboardType="number-pad"
                          style={s.input}
                          accessibilityLabel={`راحة التمرين ${index + 1}`}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <Pressable
                onPress={addDraftExercise}
                disabled={draftExercises.length >= 12}
                style={s.addExercise}
                accessibilityRole="button"
              >
                <Ion name="add-circle-outline" size={20} color={C.green} />
                <Text style={s.link}>
                  {draftExercises.length >= 12
                    ? "الحد الأقصى ١٢ تمرينًا"
                    : "إضافة تمرين"}
                </Text>
              </Pressable>
            </View>
            <Btn title="حفظ الخطة" primary onPress={savePlan} />
            <Pressable onPress={() => setModal(null)} style={s.cancel}>
              <Text style={s.muted}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={modal === "onboarding"}
        transparent
        animationType="fade"
        onRequestClose={() => {
          updatePrefs({ onboardingDone: true });
          setModal(null);
        }}
      >
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.mark}>
              <Ion name="pulse" size={31} color={C.ink} />
            </View>
            <Text style={s.kicker}>خطوتك الأولى تبدأ الآن</Text>
            <H>خلّينا نتعرّف عليك</H>
            <Text style={s.muted}>
              نضبط تجربتك على هدفك، وتقدر تغيّرها بأي وقت.
            </Text>
            <Text style={s.label}>بماذا نناديك؟</Text>
            <TextInput
              value={data.preferences.name}
              onChangeText={(name) => updatePrefs({ name })}
              placeholder="اسمك (اختياري)"
              placeholderTextColor={C.muted}
              style={s.input}
              accessibilityLabel="اسمك"
            />
            <Text style={s.label}>هدفك هذا الشهر</Text>
            <View style={s.chips}>
              {["قوة ولياقة", "مرونة", "نشاط يومي"].map((g) => (
                <Pressable
                  key={g}
                  onPress={() => updatePrefs({ goal: g })}
                  style={[s.chip, data.preferences.goal === g && s.chipActive]}
                >
                  <Text
                    style={[
                      s.chipText,
                      data.preferences.goal === g && s.chipTextActive,
                    ]}
                  >
                    {g}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.label}>مستواك الحالي</Text>
            <View style={s.chips}>
              {["مبتدئ", "متوسط", "متقدم"].map((level) => (
                <Pressable
                  key={level}
                  onPress={() => updatePrefs({ level })}
                  style={[
                    s.chip,
                    data.preferences.level === level && s.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      s.chipText,
                      data.preferences.level === level && s.chipTextActive,
                    ]}
                  >
                    {level}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Btn
              title="يلا نبدأ"
              primary
              onPress={() => {
                updatePrefs({ onboardingDone: true });
                setModal(null);
                msg("مساحتك جاهزة — اختر تمرينًا وابدأ وقتما تحب");
              }}
            />
            <Pressable
              onPress={() => {
                updatePrefs({ onboardingDone: true });
                setModal(null);
              }}
              style={s.cancel}
            >
              <Text style={s.muted}>تخطّي الآن</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={modal === "timer"}
        animationType="slide"
        onRequestClose={stopWorkout}
      >
        <SafeAreaView style={s.timer}>
          <View style={s.timerHead}>
            <Pressable onPress={stopWorkout} accessibilityLabel="إغلاق المؤقت">
              <Ion name="close" size={25} color={C.ink} />
            </Pressable>
            <Text style={s.planTitle}>جلسة نبض</Text>
            <Pressable onPress={stopWorkout} accessibilityLabel="إنهاء التمرين">
              <Ion name="stop-circle-outline" size={23} color={C.ink} />
            </Pressable>
          </View>
          {exercise && (
            <>
              <View style={s.timerName}>
                <Text style={s.tag}>
                  {resting
                    ? "وقت الراحة"
                    : `التمرين ${fa(exerciseIndex + 1)} من ${fa(activePlan?.exercises.length ?? 0)}`}
                </Text>
                <Text style={s.timerExercise}>
                  {resting ? "تنفّس واستعد" : exercise.name}
                </Text>
                <Text style={s.muted}>
                  {resting
                    ? `التالية: ${exercise.name}`
                    : `المجموعة ${fa(setIndex)} من ${fa(exercise.sets)} · ${fa(exercise.reps)} تكرار`}
                </Text>
              </View>
              <View style={s.dial}>
                <Svg width={264} height={264} viewBox="0 0 264 264">
                  <Circle
                    cx={132}
                    cy={132}
                    r={115}
                    stroke={C.line}
                    strokeWidth={11}
                    fill="none"
                  />
                  <Circle
                    cx={132}
                    cy={132}
                    r={115}
                    stroke={C.lime}
                    strokeWidth={11}
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 115}`}
                    strokeDashoffset={`${2 * Math.PI * 115 * (1 - seconds / Math.max(1, resting ? exercise.restSeconds : exercise.durationSeconds))}`}
                    strokeLinecap="round"
                    rotation="-90"
                    origin="132,132"
                  />
                </Svg>
                <View style={s.dialCenter}>
                  <Text style={s.digits}>
                    {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                    {String(seconds % 60).padStart(2, "0")}
                  </Text>
                  <Text style={s.muted}>{resting ? "راحة" : "باقي"}</Text>
                </View>
              </View>
              <Text style={s.next}>
                ←{" "}
                {resting
                  ? "بعدها، نكمل المجموعة"
                  : `الراحة التالية ${fa(exercise.restSeconds)} ثانية`}
              </Text>
              <View style={s.timerControls}>
                <Pressable
                  onPress={() => {
                    if (paused) {
                      setDeadline(Date.now() + Math.max(1, seconds) * 1000);
                      setPaused(false);
                    } else setPaused(true);
                  }}
                  style={s.pause}
                >
                  <Ion
                    name={paused ? "play" : "pause"}
                    size={22}
                    color={C.ink}
                  />
                  <Text style={s.buttonText}>
                    {paused ? "متابعة" : "إيقاف مؤقت"}
                  </Text>
                </Pressable>
                <Pressable onPress={advance} style={s.skip}>
                  <Text style={s.buttonText}>تخطّي المرحلة</Text>
                  <Ion name="play-skip-forward" size={18} color={C.ink} />
                </Pressable>
              </View>
              <Text style={s.version}>{activePlan?.title}</Text>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
const Ion = Ionicons;
const s = StyleSheet.create({
  exerciseList: { gap: 8 },
  exerciseScroll: { maxHeight: 340 },
  exerciseDraft: {
    backgroundColor: C.paper,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
    marginBottom: 8,
  },
  exerciseDraftHead: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  addExercise: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 42,
  },
  fieldRow: { flexDirection: "row-reverse", gap: 8 },
  fieldCell: { flex: 1 },
  inline: { flexDirection: "row-reverse", alignItems: "center", gap: 14 },
  counter: {
    color: C.green,
    fontSize: 22,
    fontWeight: "700",
    paddingHorizontal: 7,
  },
  counterValue: { color: C.ink, fontSize: 15, fontWeight: "700" },
  safe: { flex: 1, backgroundColor: C.bg },
  app: { flex: 1, maxWidth: 760, width: "100%" as any, alignSelf: "center" },
  content: { paddingHorizontal: 22, paddingTop: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  muted: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "right" },
  kicker: { color: C.muted, fontSize: 13, textAlign: "right" },
  heading: {
    fontSize: 22,
    color: C.ink,
    fontWeight: "800",
    textAlign: "right",
  },
  title: { fontSize: 32, marginTop: 5 },
  top: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 24,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: C.ink, fontSize: 19, fontWeight: "800" },
  week: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 17,
    borderBottomWidth: 1,
    borderColor: C.line,
    paddingBottom: 18,
    marginBottom: 24,
  },
  weekBig: {
    color: C.ink,
    fontSize: 23,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 5,
  },
  weekUnit: { color: C.muted, fontSize: 13, fontWeight: "500" },
  divider: { width: 1, height: 38, backgroundColor: C.line },
  streak: {
    marginLeft: "auto",
    borderRadius: 20,
    backgroundColor: "#ECEFE5",
    paddingVertical: 7,
    paddingHorizontal: 10,
    color: C.green,
    fontSize: 12,
    fontWeight: "700",
  },
  section: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
    marginTop: 8,
  },
  caption: { color: C.muted, fontSize: 12 },
  hero: {
    backgroundColor: C.lime,
    borderRadius: 26,
    padding: 22,
    marginBottom: 27,
    minHeight: 220,
    justifyContent: "space-between",
  },
  heroTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tag: {
    backgroundColor: "rgba(32,35,31,.10)",
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 99,
    color: C.ink,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
  heroTitle: {
    color: C.ink,
    fontWeight: "800",
    fontSize: 26,
    textAlign: "right",
    marginTop: 18,
  },
  heroSub: { color: "#4E5943", fontSize: 13, textAlign: "right", marginTop: 6 },
  heroBottom: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 17,
  },
  stat: { color: C.ink, fontSize: 17, fontWeight: "800", textAlign: "right" },
  start: {
    width: 72,
    height: 72,
    borderRadius: 38,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  startLabel: { color: C.ink, fontWeight: "700", fontSize: 11 },
  planCard: {
    backgroundColor: C.paper,
    borderRadius: 20,
    flexDirection: "row-reverse",
    overflow: "hidden",
    marginBottom: 11,
    borderWidth: 1,
    borderColor: C.line,
  },
  accent: { width: 7 },
  planBody: { flex: 1, padding: 16 },
  planTitle: {
    color: C.ink,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  actions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 7,
    marginTop: 13,
  },
  button: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 99,
    minHeight: 44,
    paddingHorizontal: 16,
    flexDirection: "row-reverse",
    gap: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  primary: { backgroundColor: C.lime, borderColor: C.lime },
  buttonText: { color: C.ink, fontSize: 14, fontWeight: "700" },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  link: { color: C.green, fontSize: 13, fontWeight: "700" },
  tip: {
    backgroundColor: "#ECE9DF",
    padding: 16,
    borderRadius: 17,
    marginTop: 8,
  },
  tabBar: {
    height: 68,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.paper,
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    alignItems: "center",
  },
  tab: {
    minWidth: 64,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabLabel: { fontSize: 11, color: C.muted },
  tabSelected: { color: C.ink, fontWeight: "800" },
  add: {
    width: 44,
    height: 44,
    borderRadius: 23,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: C.paper,
    borderRadius: 15,
    paddingHorizontal: 13,
    height: 49,
    gap: 9,
    borderWidth: 1,
    borderColor: C.line,
  },
  searchInput: { flex: 1, textAlign: "right", color: C.ink, fontSize: 14 },
  chips: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 13,
  },
  chip: {
    borderRadius: 30,
    backgroundColor: "#ECE9DF",
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  chipActive: { backgroundColor: C.ink },
  chipText: { color: C.ink, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: C.paper },
  empty: {
    alignItems: "center",
    backgroundColor: C.paper,
    padding: 24,
    gap: 10,
    borderRadius: 20,
    marginVertical: 10,
  },
  progress: {
    backgroundColor: C.ink,
    borderRadius: 25,
    padding: 20,
    marginTop: 24,
  },
  progressHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chartTitle: { color: "#D8D9D0", fontSize: 13, textAlign: "right" },
  progressNum: {
    color: C.paper,
    fontSize: 36,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 5,
  },
  chartHint: {
    color: "#BABCB3",
    fontSize: 11,
    textAlign: "right",
    marginTop: 10,
  },
  progressBadge: {
    borderRadius: 20,
    backgroundColor: "#30382B",
    color: C.lime,
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
  },
  bars: {
    height: 105,
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    justifyContent: "space-around",
    gap: 11,
    marginTop: 22,
  },
  barWrap: { flex: 1, alignItems: "center", gap: 8 },
  track: {
    height: 80,
    width: "100%",
    backgroundColor: "#343A32",
    borderRadius: 12,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  fill: { width: "100%", borderRadius: 12, backgroundColor: C.lime },
  barLabel: { color: "#C7C9C0", fontSize: 11 },
  metrics: { flexDirection: "row-reverse", gap: 10, marginTop: 13 },
  metric: {
    flex: 1,
    padding: 15,
    borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
  },
  metricVal: {
    color: C.ink,
    fontSize: 23,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 8,
  },
  metricUnit: { fontSize: 12, color: C.muted },
  log: {
    flexDirection: "row-reverse",
    gap: 12,
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: 20,
    backgroundColor: "#ECEFE5",
    alignItems: "center",
    justifyContent: "center",
  },
  logVol: { color: C.green, fontWeight: "700", fontSize: 12 },
  profile: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 13,
    backgroundColor: C.paper,
    borderRadius: 19,
    padding: 15,
    marginVertical: 18,
    borderWidth: 1,
    borderColor: C.line,
  },
  settings: {
    backgroundColor: C.paper,
    borderRadius: 19,
    paddingHorizontal: 16,
    paddingTop: 15,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: C.line,
  },
  group: {
    color: C.muted,
    fontSize: 12,
    textAlign: "right",
    marginBottom: 5,
    fontWeight: "700",
  },
  setting: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  unit: {
    flexDirection: "row-reverse",
    gap: 7,
    alignItems: "center",
    backgroundColor: C.bg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  unitTxt: { color: C.ink, fontSize: 12, fontWeight: "700" },
  reset: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
    paddingVertical: 15,
  },
  version: {
    color: C.muted,
    fontSize: 11,
    textAlign: "center",
    marginVertical: 12,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(20,22,19,.48)",
  },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === "web" ? 25 : 35,
    gap: 12,
  },
  handle: {
    alignSelf: "center",
    width: 39,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#D0CEC4",
    marginBottom: 8,
  },
  label: {
    color: C.ink,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 7,
  },
  input: {
    backgroundColor: C.paper,
    color: C.ink,
    fontSize: 16,
    textAlign: "right",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 15,
  },
  cancel: { alignItems: "center", paddingVertical: 9 },
  mark: {
    width: 60,
    height: 60,
    alignSelf: "flex-end",
    borderRadius: 32,
    backgroundColor: C.lime,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  timer: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 22 },
  timerHead: {
    height: 55,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timerName: { alignItems: "center", marginTop: 25, gap: 9 },
  timerExercise: {
    color: C.ink,
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 5,
  },
  dial: {
    width: 264,
    height: 264,
    alignSelf: "center",
    marginTop: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  dialCenter: { position: "absolute", alignItems: "center", gap: 2 },
  digits: {
    color: C.ink,
    fontSize: 52,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  next: { color: C.muted, fontSize: 13, textAlign: "center", marginTop: 20 },
  timerControls: { flexDirection: "row-reverse", gap: 10, marginTop: 26 },
  pause: {
    flex: 1,
    backgroundColor: C.lime,
    minHeight: 56,
    borderRadius: 17,
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  skip: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.line,
    minHeight: 56,
    borderRadius: 17,
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  notice: {
    backgroundColor: "#ECEFE5",
    padding: 11,
    borderRadius: 13,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  noticeText: {
    flex: 1,
    color: C.ink,
    fontSize: 12,
    textAlign: "right",
    lineHeight: 18,
  },
  toast: {
    position: "absolute",
    bottom: 78,
    left: 18,
    right: 18,
    backgroundColor: C.ink,
    borderRadius: 15,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  toastText: {
    color: C.paper,
    fontSize: 13,
    textAlign: "right",
    flex: 1,
    lineHeight: 19,
  },
});
