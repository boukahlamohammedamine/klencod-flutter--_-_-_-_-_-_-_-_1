export type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  restSeconds: number;
  durationSeconds: number;
};
export type WorkoutPlan = {
  id: string;
  title: string;
  focus: string;
  color: string;
  exercises: Exercise[];
  scheduled?: string;
};
export type WorkoutLog = {
  id: string;
  planId: string;
  title: string;
  date: string;
  durationMinutes: number;
  volume: number;
};
export type Preferences = {
  name: string;
  goal: string;
  level: string;
  units: "kg" | "lb";
  sound: boolean;
  haptics: boolean;
  reminders: boolean;
  reminderHour: number;
  reminderMinute: number;
  onboardingDone: boolean;
};
export type WorkoutData = {
  version: 1;
  plans: WorkoutPlan[];
  logs: WorkoutLog[];
  preferences: Preferences;
  updatedAt: number;
};
const exercise = (
  id: string,
  name: string,
  sets: number,
  reps: number,
  restSeconds = 60,
  durationSeconds = 35,
): Exercise => ({ id, name, sets, reps, restSeconds, durationSeconds });
export const seedData = (): WorkoutData => ({
  version: 1,
  updatedAt: Date.now(),
  preferences: {
    name: "",
    goal: "قوة ولياقة",
    level: "متوسط",
    units: "kg",
    sound: true,
    haptics: true,
    reminders: false,
    reminderHour: 18,
    reminderMinute: 0,
    onboardingDone: false,
  },
  plans: [
    {
      id: "plan-strength",
      title: "قوة الجسم بالكامل",
      focus: "قوة · ٣٥ دقيقة",
      color: "#C7F36B",
      scheduled: "اليوم",
      exercises: [
        exercise("e1", "قرفصاء", 3, 12, 60, 35),
        exercise("e2", "ضغط", 3, 10, 60, 35),
        exercise("e3", "اندفاع أمامي", 3, 10, 50, 35),
        exercise("e4", "بلانك", 3, 12, 45, 40),
      ],
    },
    {
      id: "plan-mobility",
      title: "حركة واستشفاء",
      focus: "مرونة · ٢٠ دقيقة",
      color: "#E8B79E",
      exercises: [
        exercise("e5", "إطالة القطّة", 2, 8, 30, 40),
        exercise("e6", "فتح الورك", 2, 8, 30, 40),
        exercise("e7", "جسر الأرداف", 3, 12, 45, 35),
      ],
    },
    {
      id: "plan-upper",
      title: "الجزء العلوي",
      focus: "قوة · ٣٠ دقيقة",
      color: "#B6C3EC",
      exercises: [
        exercise("e8", "ضغط مائل", 3, 12, 60, 35),
        exercise("e9", "رفع جانبي", 3, 12, 45, 35),
        exercise("e10", "سوبرمان", 3, 10, 45, 35),
      ],
    },
  ],
  logs: [],
});
