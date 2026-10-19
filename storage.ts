import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedData, type WorkoutData } from "./model";
const KEY = "nabd.workout-data.v1";
let writeTail: Promise<void> = Promise.resolve();
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isExercise = (value: unknown) =>
  isObject(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  Number.isFinite(value.sets) &&
  Number.isFinite(value.reps) &&
  Number.isFinite(value.restSeconds) &&
  Number.isFinite(value.durationSeconds);
const isPlan = (value: unknown) =>
  isObject(value) &&
  typeof value.id === "string" &&
  typeof value.title === "string" &&
  typeof value.focus === "string" &&
  typeof value.color === "string" &&
  Array.isArray(value.exercises) &&
  value.exercises.length > 0 &&
  value.exercises.every(isExercise);
const isLog = (value: unknown) =>
  isObject(value) &&
  typeof value.id === "string" &&
  typeof value.planId === "string" &&
  typeof value.title === "string" &&
  typeof value.date === "string" &&
  Number.isFinite(Date.parse(value.date)) &&
  Number.isFinite(value.durationMinutes) &&
  Number.isFinite(value.volume);
const isPreferences = (value: unknown) =>
  isObject(value) &&
  typeof value.name === "string" &&
  typeof value.goal === "string" &&
  typeof value.level === "string" &&
  (value.units === "kg" || value.units === "lb") &&
  typeof value.sound === "boolean" &&
  typeof value.haptics === "boolean" &&
  typeof value.reminders === "boolean" &&
  Number.isInteger(value.reminderHour) &&
  Number(value.reminderHour) >= 0 &&
  Number(value.reminderHour) <= 23 &&
  Number.isInteger(value.reminderMinute) &&
  Number(value.reminderMinute) >= 0 &&
  Number(value.reminderMinute) <= 59 &&
  typeof value.onboardingDone === "boolean";
export async function loadWorkoutData(): Promise<{
  data: WorkoutData;
  recovered: boolean;
}> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { data: seedData(), recovered: false };
    const parsed = JSON.parse(raw) as Partial<WorkoutData>;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.plans) ||
      !parsed.plans.every(isPlan) ||
      !Array.isArray(parsed.logs) ||
      !parsed.logs.every(isLog) ||
      !isPreferences(parsed.preferences)
    )
      throw new Error("Invalid workout data");
    return {
      data: {
        ...seedData(),
        ...parsed,
        preferences: { ...seedData().preferences, ...parsed.preferences },
      } as WorkoutData,
      recovered: false,
    };
  } catch {
    return { data: seedData(), recovered: true };
  }
}
export function saveWorkoutData(data: WorkoutData): Promise<void> {
  writeTail = writeTail
    .catch(() => undefined)
    .then(() =>
      AsyncStorage.setItem(
        KEY,
        JSON.stringify({ ...data, updatedAt: Date.now() }),
      ),
    );
  return writeTail;
}
