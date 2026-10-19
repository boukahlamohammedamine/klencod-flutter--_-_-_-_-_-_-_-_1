import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
const REMINDER_ID_KEY = "nabd.workout-reminder-id.v1";
export async function scheduleWorkoutReminder(
  hour: number,
  minute: number,
  sound = true,
): Promise<"scheduled" | "denied" | "unsupported" | "error"> {
  if (Platform.OS === "web") return "unsupported";
  try {
    const Notifications = await import("expo-notifications");
    const permissions = await Notifications.getPermissionsAsync();
    const granted =
      permissions.granted ||
      (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return "denied";
    const previousId = await AsyncStorage.getItem(REMINDER_ID_KEY);
    const nextId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "وقت نبضك",
        body: "تمرينك بانتظارك — ابدأ بخطوة صغيرة اليوم.",
        sound: sound ? "default" : false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    try {
      await AsyncStorage.setItem(REMINDER_ID_KEY, nextId);
    } catch (error) {
      await Notifications.cancelScheduledNotificationAsync(nextId).catch(
        () => undefined,
      );
      throw error;
    }
    if (previousId && previousId !== nextId) {
      await Notifications.cancelScheduledNotificationAsync(previousId).catch(
        () => undefined,
      );
    }
    return "scheduled";
  } catch {
    return "error";
  }
}
export async function cancelWorkoutReminder(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const id = await AsyncStorage.getItem(REMINDER_ID_KEY);
    if (id) {
      const Notifications = await import("expo-notifications");
      await Notifications.cancelScheduledNotificationAsync(id);
    }
    await AsyncStorage.removeItem(REMINDER_ID_KEY);
  } catch {
    /* Keep settings usable when the OS notification service is unavailable. */
  }
}
