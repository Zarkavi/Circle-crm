import { addDays, format, subDays } from "date-fns";
import type { TableName, Tables } from "./types";
import { uid } from "./utils";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const bday = (offsetDays: number, year?: number) => {
  const d = addDays(new Date(), offsetDays);
  return year ? `${year}-${format(d, "MM-dd")}` : `--${format(d, "MM-dd")}`;
};

/** Sample data so demo mode isn't empty. */
export function seedData(): { [K in TableName]: Tables[K][] } {
  const now = new Date().toISOString();
  const t = { created_at: now, updated_at: now };
  const anna = uid(), john = uid(), sara = uid(), mark = uid(), lena = uid();
  const tInv = uid(), tFam = uid(), tGym = uid(), tWork = uid();

  return {
    people: [
      { id: anna, full_name: "Anna Kowalski", nickname: "Ania", email: "anna@example.com", phone: "+48 600 100 200", birthday: bday(5, 1988), city: "Warsaw", how_we_met: "Web Summit 2022, sat next to each other at the AI panel", notes: "Thinking about leaving Stripe to start a fintech company. Asked me to intro her to angel investors.", keep_in_touch_days: 30, favorite: true, ...t },
      { id: john, full_name: "John Miller", email: "john@example.com", phone: "+1 415 555 0134", birthday: bday(40, 1979), city: "San Francisco", how_we_met: "Introduced by Anna", notes: "Angel investor, mostly fintech and dev tools.", keep_in_touch_days: 60, favorite: false, ...t },
      { id: sara, full_name: "Sara Chen", birthday: bday(18), city: "London", how_we_met: "Old university friend", notes: "", keep_in_touch_days: 21, favorite: true, ...t },
      { id: mark, full_name: "Mark Chen", city: "London", how_we_met: "Sara's husband", notes: "Big Arsenal fan.", favorite: false, ...t },
      { id: lena, full_name: "Lena Fischer", email: "lena@example.com", city: "Berlin", how_we_met: "Gym, Tuesday morning class", keep_in_touch_days: 14, favorite: false, ...t },
    ],
    jobs: [
      { id: uid(), person_id: anna, company: "Stripe", title: "Product Lead, Payments", start_date: "2021", is_current: true, ...t },
      { id: uid(), person_id: anna, company: "Revolut", title: "Senior PM", start_date: "2018", end_date: "2021", is_current: false, ...t },
      { id: uid(), person_id: john, company: "Miller Ventures", title: "Founder & GP", start_date: "2015", is_current: true, ...t },
      { id: uid(), person_id: sara, company: "NHS", title: "Pediatric doctor", is_current: true, ...t },
      { id: uid(), person_id: lena, company: "Zalando", title: "Engineering Manager", start_date: "2020", is_current: true, ...t },
    ],
    relationships: [
      { id: uid(), person_id: anna, name: "Zosia", relation: "child", birthday: bday(70, 2017), notes: "Loves horses, takes riding lessons", ...t },
      { id: uid(), person_id: anna, name: "Kuba", relation: "child", birthday: "--03-14", notes: "Plays chess", ...t },
      { id: uid(), person_id: anna, name: "Piotr", relation: "spouse", notes: "Architect", ...t },
      { id: uid(), person_id: john, related_person_id: anna, relation: "introduced_by", ...t },
      { id: uid(), person_id: sara, related_person_id: mark, relation: "spouse", ...t },
      { id: uid(), person_id: sara, name: "Leo", relation: "child", birthday: bday(9, 2021), ...t },
      { id: uid(), person_id: sara, name: "Biscuit", relation: "pet", notes: "Golden retriever", ...t },
    ],
    facts: [
      { id: uid(), person_id: anna, category: "food", content: "Vegetarian, loves Georgian food", ...t },
      { id: uid(), person_id: anna, category: "drinks", content: "Flat white with oat milk", ...t },
      { id: uid(), person_id: anna, category: "hobbies", content: "Runs half-marathons" , ...t },
      { id: uid(), person_id: john, category: "hobbies", content: "Sails on weekends, owns a boat called 'Second Wind'", ...t },
      { id: uid(), person_id: john, category: "dislikes", content: "Hates long pitch decks — max 10 slides", ...t },
      { id: uid(), person_id: sara, category: "food", content: "Allergic to peanuts", ...t },
      { id: uid(), person_id: sara, category: "gifts", content: "Collects vintage tea cups", ...t },
      { id: uid(), person_id: lena, category: "music", content: "Into techno, goes to Berghain", ...t },
    ],
    interactions: [
      { id: uid(), person_id: anna, date: iso(subDays(new Date(), 3)), kind: "coffee", title: "Coffee at Café Bristol", notes: "Talked about her startup idea (SMB invoicing). Zosia started riding lessons. Follow up with John intro.", location: "Warsaw", ...t },
      { id: uid(), person_id: anna, date: iso(subDays(new Date(), 64)), kind: "call", title: "Catch-up call", notes: "Piotr got a new project in Kraków.", ...t },
      { id: uid(), person_id: john, date: iso(subDays(new Date(), 75)), kind: "meal", title: "Lunch", notes: "He's raising Fund III. Interested in Polish fintech.", location: "SF", ...t },
      { id: uid(), person_id: sara, date: iso(subDays(new Date(), 30)), kind: "call", title: "Video call", notes: "Leo starts nursery in September.", ...t },
      { id: uid(), person_id: lena, date: iso(subDays(new Date(), 20)), kind: "event", title: "Gym class + smoothie", notes: "Training for Berlin marathon.", ...t },
    ],
    reminders: [
      { id: uid(), person_id: anna, title: "Intro Anna to John Miller", due_date: iso(addDays(new Date(), 1)), repeat: "none", done: false, ...t },
      { id: uid(), person_id: lena, title: "Ask how the marathon went", due_date: iso(subDays(new Date(), 1)), repeat: "none", done: false, ...t },
      { id: uid(), person_id: sara, title: "Send anniversary card", due_date: iso(addDays(new Date(), 12)), repeat: "yearly", done: false, ...t },
    ],
    tags: [
      { id: tInv, name: "Investors", color: "emerald", ...t },
      { id: tFam, name: "Close friends", color: "rose", ...t },
      { id: tGym, name: "Gym", color: "amber", ...t },
      { id: tWork, name: "Tech", color: "sky", ...t },
    ],
    person_tags: [
      { id: uid(), person_id: john, tag_id: tInv, ...t },
      { id: uid(), person_id: anna, tag_id: tWork, ...t },
      { id: uid(), person_id: sara, tag_id: tFam, ...t },
      { id: uid(), person_id: lena, tag_id: tGym, ...t },
      { id: uid(), person_id: lena, tag_id: tWork, ...t },
    ],
  };
}
