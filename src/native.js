import { registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Native predictive back: forwards the system back-swipe progress to JS (see android-native/BackPlugin.java)
export const Back = registerPlugin('PredictiveBack');

const IDS = { task: 101, habit: 102, walk: 103, diary: 104, mood: 105 };
export async function syncReminders(rem, t) {
  try {
    await LocalNotifications.cancel({ notifications: Object.values(IDS).map((id) => ({ id })) });
    const on = Object.keys(IDS).filter((k) => rem[k]?.on);
    if (!on.length) return;
    const p = await LocalNotifications.requestPermissions();
    if (p.display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: on.map((k) => {
        const [hour, minute] = rem[k].time.split(':').map(Number);
        return { id: IDS[k], title: 'Moodys', body: t('n_' + k), schedule: { on: { hour, minute }, allowWhileIdle: true } };
      }),
    });
  } catch {}
}
