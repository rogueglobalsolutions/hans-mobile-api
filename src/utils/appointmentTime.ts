export const LEGACY_APPOINTMENT_TIME_ZONE = "America/Los_Angeles";

export function normalizeAppointmentTimeZone(value?: string | null) {
  const timeZone = value?.trim() || LEGACY_APPOINTMENT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new Error("Appointment time zone is invalid");
  }
  return timeZone;
}

function minutesFromTime(time: string) {
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/.exec(time);
  if (!match) throw new Error("Appointment time must be valid");
  return (Number(match[1]) % 12 + (match[3] === "PM" ? 12 : 0)) * 60 + Number(match[2]);
}

export function appointmentHasStarted(date: string, time: string, zone: string, now = new Date()) {
  const timeZone = normalizeAppointmentTimeZone(zone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  const localDate = `${part("year")}-${part("month")}-${part("day")}`;
  if (date !== localDate) return date < localDate;
  const localMinutes = Number(part("hour")) * 60 + Number(part("minute"));
  return minutesFromTime(time) <= localMinutes;
}
